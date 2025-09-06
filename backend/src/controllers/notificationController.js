const axios = require('axios');
const { logger } = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const { performanceMonitor } = require('../middleware/monitoring');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

exports.updateFCMToken = catchAsync(async (req, res, next) => {
  const { fcmToken, deviceType, deviceId } = req.body;
  const userId = req.user.id;

  if (!fcmToken) {
    return next(new AppError('FCM token is required', 400));
  }

  try {
    const User = require('../models/User');
    await User.update(
      { 
        fcmToken,
        deviceType: deviceType || 'unknown',
        deviceId: deviceId || null,
        lastTokenUpdate: new Date()
      },
      { where: { id: userId } }
    );

    // Cache the token for quick access
    await cacheService.set(`fcm_token:${userId}`, fcmToken, 86400); // 24 hours

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully'
    });

  } catch (error) {
    logger.error('Error updating FCM token:', error);
    return next(new AppError('Failed to update FCM token', 500));
  }
});

exports.sendTestNotification = catchAsync(async (req, res, next) => {
  const { title, body, data = {} } = req.body;
  const userId = req.user.id;

  try {
    const User = require('../models/User');
    const user = await User.findByPk(userId);

    if (!user || !user.fcmToken) {
      return next(new AppError('User FCM token not found', 404));
    }

    // Send via AI service
    const response = await axios.post(`${AI_SERVICE_URL}/api/notifications/send`, {
      token: user.fcmToken,
      title: title || 'Test Notification',
      body: body || 'This is a test notification from AI Travel',
      data: {
        ...data,
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });

    res.status(200).json({
      success: true,
      messageId: response.data.message_id,
      message: 'Test notification sent successfully'
    });

  } catch (error) {
    logger.error('Error sending test notification:', error);
    return next(new AppError('Failed to send test notification', 500));
  }
});

exports.getNotificationSettings = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    // Get from cache first
    const cacheKey = `notification_settings:${userId}`;
    let settings = await cacheService.get(cacheKey);

    if (!settings) {
      const User = require('../models/User');
      const user = await User.findByPk(userId);
      
      settings = {
        pushNotifications: user?.notificationSettings?.push ?? true,
        locationBasedAlerts: user?.notificationSettings?.location ?? true,
        chatbotMessages: user?.notificationSettings?.chatbot ?? true,
        recommendations: user?.notificationSettings?.recommendations ?? true,
        quietHours: user?.notificationSettings?.quietHours ?? { start: 22, end: 7 },
        maxPerHour: user?.notificationSettings?.maxPerHour ?? 3,
        categories: user?.notificationSettings?.categories ?? {
          restaurant: true,
          attraction: true,
          activity: true,
          transport: false,
          weather: true
        }
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, settings, 3600);
    }

    res.status(200).json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Error getting notification settings:', error);
    return next(new AppError('Failed to get notification settings', 500));
  }
});

exports.updateNotificationSettings = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const settings = req.body;

  try {
    const User = require('../models/User');
    await User.update(
      { notificationSettings: settings },
      { where: { id: userId } }
    );

    // Update cache
    const cacheKey = `notification_settings:${userId}`;
    await cacheService.set(cacheKey, settings, 3600);

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully'
    });

  } catch (error) {
    logger.error('Error updating notification settings:', error);
    return next(new AppError('Failed to update notification settings', 500));
  }
});

exports.scheduleLocationNotification = catchAsync(async (req, res, next) => {
  const { poiId, context = {} } = req.body;
  const userId = req.user.id;

  if (!poiId) {
    return next(new AppError('POI ID is required', 400));
  }

  try {
    const POI = require('../models/POI');
    const poi = await POI.findByPk(poiId);

    if (!poi) {
      return next(new AppError('POI not found', 404));
    }

    // Schedule notification through notification service
    const notificationId = await notificationService.scheduleContextualNotification(
      userId,
      poi,
      context
    );

    if (notificationId) {
      res.status(200).json({
        success: true,
        notificationId,
        message: 'Location notification scheduled successfully'
      });
    } else {
      res.status(200).json({
        success: false,
        message: 'Notification not scheduled (possibly filtered out)'
      });
    }

  } catch (error) {
    logger.error('Error scheduling location notification:', error);
    return next(new AppError('Failed to schedule notification', 500));
  }
});

exports.getNotificationHistory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 20, offset = 0, type } = req.query;

  try {
    const { sequelize } = require('../config/database');
    
    let whereClause = 'user_id = ? AND event = ?';
    let replacements = [userId, 'notification_sent'];

    if (type) {
      whereClause += ' AND JSON_EXTRACT(payload, "$.type") = ?';
      replacements.push(type);
    }

    const query = `
      SELECT 
        JSON_EXTRACT(payload, '$.title') as title,
        JSON_EXTRACT(payload, '$.body') as body,
        JSON_EXTRACT(payload, '$.type') as type,
        JSON_EXTRACT(payload, '$.poi_id') as poi_id,
        created_at
      FROM user_activity_logs 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const notifications = await sequelize.query(query, {
      replacements: [...replacements, parseInt(limit), parseInt(offset)],
      type: sequelize.QueryTypes.SELECT
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: notifications.length
        }
      }
    });

  } catch (error) {
    logger.error('Error getting notification history:', error);
    return next(new AppError('Failed to get notification history', 500));
  }
});

exports.markNotificationRead = catchAsync(async (req, res, next) => {
  const { notificationId } = req.params;
  const userId = req.user.id;

  try {
    // Log notification interaction
    const { sequelize } = require('../config/database');
    
    await sequelize.query(`
      INSERT INTO user_activity_logs (user_id, event, payload, created_at)
      VALUES (?, ?, ?, NOW())
    `, {
      replacements: [
        userId,
        'notification_read',
        JSON.stringify({
          notificationId,
          timestamp: new Date().toISOString()
        })
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return next(new AppError('Failed to mark notification as read', 500));
  }
});

exports.getNotificationStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const { sequelize } = require('../config/database');
    
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_sent,
        COUNT(CASE WHEN JSON_EXTRACT(payload, '$.type') = 'poi_suggestion' THEN 1 END) as poi_suggestions,
        COUNT(CASE WHEN JSON_EXTRACT(payload, '$.type') = 'chatbot' THEN 1 END) as chatbot_messages,
        COUNT(CASE WHEN JSON_EXTRACT(payload, '$.type') = 'recommendation' THEN 1 END) as recommendations,
        AVG(CASE WHEN JSON_EXTRACT(payload, '$.relevance_score') IS NOT NULL 
                 THEN JSON_EXTRACT(payload, '$.relevance_score') END) as avg_relevance_score
      FROM user_activity_logs 
      WHERE user_id = ? 
        AND event = 'notification_sent'
        AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, {
      replacements: [userId],
      type: sequelize.QueryTypes.SELECT
    });

    const readStats = await sequelize.query(`
      SELECT COUNT(*) as total_read
      FROM user_activity_logs 
      WHERE user_id = ? 
        AND event = 'notification_read'
        AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, {
      replacements: [userId],
      type: sequelize.QueryTypes.SELECT
    });

    const result = {
      ...stats[0],
      total_read: readStats[0].total_read,
      read_rate: stats[0].total_sent > 0 ? 
        (readStats[0].total_read / stats[0].total_sent * 100).toFixed(2) : 0
    };

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error getting notification stats:', error);
    return next(new AppError('Failed to get notification stats', 500));
  }
});

exports.enableGeofencing = catchAsync(async (req, res, next) => {
  const { latitude, longitude, radius = 500, poiIds = [] } = req.body;
  const userId = req.user.id;

  if (!latitude || !longitude) {
    return next(new AppError('Location coordinates are required', 400));
  }

  try {
    // Store geofence configuration
    const geofence = {
      userId,
      center: { latitude, longitude },
      radius,
      poiIds,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    // Cache geofence settings
    const cacheKey = `geofence:${userId}`;
    await cacheService.set(cacheKey, geofence, 86400); // 24 hours

    // Log geofence activation
    const { sequelize } = require('../config/database');
    await sequelize.query(`
      INSERT INTO user_activity_logs (user_id, event, payload, created_at)
      VALUES (?, ?, ?, NOW())
    `, {
      replacements: [
        userId,
        'geofence_enabled',
        JSON.stringify(geofence)
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Geofencing enabled successfully',
      data: geofence
    });

  } catch (error) {
    logger.error('Error enabling geofencing:', error);
    return next(new AppError('Failed to enable geofencing', 500));
  }
});

exports.disableGeofencing = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    // Remove from cache
    const cacheKey = `geofence:${userId}`;
    await cacheService.del(cacheKey);

    // Log geofence deactivation
    const { sequelize } = require('../config/database');
    await sequelize.query(`
      INSERT INTO user_activity_logs (user_id, event, payload, created_at)
      VALUES (?, ?, ?, NOW())
    `, {
      replacements: [
        userId,
        'geofence_disabled',
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Geofencing disabled successfully'
    });

  } catch (error) {
    logger.error('Error disabling geofencing:', error);
    return next(new AppError('Failed to disable geofencing', 500));
  }
});

exports.processLocationTrigger = catchAsync(async (req, res, next) => {
  const { latitude, longitude } = req.body;
  const userId = req.user.id;

  if (!latitude || !longitude) {
    return next(new AppError('Location coordinates are required', 400));
  }

  try {
    const newLocation = { latitude, longitude };
    
    // Get previous location from cache
    const oldLocation = await cacheService.getCachedUserLocation(userId);

    // Trigger notification service location update
    await notificationService.onLocationUpdate(userId, newLocation, oldLocation);

    // Update cached location
    await cacheService.cacheUserLocation(userId, newLocation);

    res.status(200).json({
      success: true,
      message: 'Location trigger processed successfully'
    });

  } catch (error) {
    logger.error('Error processing location trigger:', error);
    return next(new AppError('Failed to process location trigger', 500));
  }
});
