const admin = require('firebase-admin');
const UserLocation = require('../models/UserLocation');
const TravelDNA = require('../models/TravelDNA');
const POI = require('../models/POI');
const { logger } = require('../config/database');
const { performanceMonitor } = require('../middleware/monitoring');

class NotificationService {
  constructor() {
    this.notificationQueue = new Map(); // Store pending notifications
    this.userNotificationHistory = new Map(); // Track notification frequency
    this.maxNotificationsPerHour = 3;
    this.quietHours = { start: 22, end: 7 }; // 10 PM to 7 AM
  }

  // Schedule notification to be sent in 5-10 minutes
  async scheduleContextualNotification(userId, poi, context = {}) {
    try {
      const user = await this.getUserWithDNA(userId);
      if (!user || !user.fcmToken) return;

      // Calculate relevance score
      const relevanceScore = await this.calculateRelevanceScore(user, poi, context);
      
      if (relevanceScore < 0.6) {
        logger.info(`Notification skipped for POI ${poi.id} - low relevance: ${relevanceScore}`);
        return;
      }

      // Check notification frequency limits
      if (!this.canSendNotification(userId)) {
        logger.info(`Notification rate limited for user ${userId}`);
        return;
      }

      // Random delay between 5-10 minutes
      const delayMinutes = Math.floor(Math.random() * 6) + 5; // 5-10 minutes
      const scheduleTime = new Date(Date.now() + delayMinutes * 60 * 1000);

      const notification = {
        userId,
        poi,
        context,
        relevanceScore,
        scheduleTime,
        type: 'poi_suggestion'
      };

      // Store in queue
      const notificationId = `${userId}_${poi.id}_${Date.now()}`;
      this.notificationQueue.set(notificationId, notification);

      // Schedule the actual send
      setTimeout(() => {
        this.sendScheduledNotification(notificationId);
      }, delayMinutes * 60 * 1000);

      logger.info(`Notification scheduled for ${delayMinutes} minutes: ${poi.name}`);
      return notificationId;

    } catch (error) {
      logger.error('Error scheduling notification:', error);
      performanceMonitor.trackAIRequest('notification_schedule', 'error');
    }
  }

  async sendScheduledNotification(notificationId) {
    try {
      const notification = this.notificationQueue.get(notificationId);
      if (!notification) return;

      const { userId, poi, context, relevanceScore } = notification;

      // Double-check if user is still in quiet hours
      if (this.isQuietHour()) {
        logger.info(`Notification delayed due to quiet hours: ${poi.name}`);
        // Reschedule for next morning
        this.rescheduleForMorning(notificationId);
        return;
      }

      // Get fresh user data
      const user = await this.getUserWithDNA(userId);
      if (!user || !user.fcmToken) {
        this.notificationQueue.delete(notificationId);
        return;
      }

      // Create notification payload
      const payload = this.createNotificationPayload(poi, context, relevanceScore);

      // Send via FCM
      await this.sendFCMNotification(user.fcmToken, payload);

      // Track notification history
      this.trackNotificationSent(userId);

      // Clean up
      this.notificationQueue.delete(notificationId);

      performanceMonitor.trackAIRequest('notification_sent', 'success');
      logger.info(`Notification sent successfully: ${poi.name} to user ${userId}`);

    } catch (error) {
      logger.error('Error sending scheduled notification:', error);
      performanceMonitor.trackAIRequest('notification_sent', 'error');
    }
  }

  async calculateRelevanceScore(user, poi, context) {
    let score = 0.5; // Base score

    // Travel DNA compatibility (40% weight)
    if (user.TravelDNA) {
      const compatibility = user.TravelDNA.isCompatibleWith(poi);
      score += compatibility.score * 0.4;
    }

    // Distance factor (20% weight)
    if (context.userLocation && poi.latitude && poi.longitude) {
      const distance = this.calculateDistance(
        context.userLocation.latitude,
        context.userLocation.longitude,
        poi.latitude,
        poi.longitude
      );
      
      // Closer is better, but within city limits (50-100km)
      const distanceScore = Math.max(0, 1 - (distance / 100)); // Normalize to 100km max
      score += distanceScore * 0.2;
    }

    // Time context (15% weight)
    const timeScore = this.calculateTimeRelevance(poi, context.timeOfDay);
    score += timeScore * 0.15;

    // POI quality (15% weight)
    const qualityScore = this.calculatePOIQuality(poi);
    score += qualityScore * 0.15;

    // Weather context (10% weight)
    const weatherScore = this.calculateWeatherRelevance(poi, context.weather);
    score += weatherScore * 0.1;

    return Math.min(1, Math.max(0, score));
  }

  calculateTimeRelevance(poi, timeOfDay) {
    const currentHour = new Date().getHours();
    
    // Check if POI is open
    if (poi.openingHours && !poi.isOpenNow()) {
      return 0.2; // Low score for closed venues
    }

    // Time-based category relevance
    const timeRelevance = {
      morning: { cafe: 0.9, restaurant: 0.7, park: 0.8, museum: 0.6 },
      afternoon: { restaurant: 0.8, shopping: 0.9, attraction: 0.9, museum: 0.8 },
      evening: { restaurant: 0.9, bar: 0.9, entertainment: 0.9, nightlife: 0.8 },
      night: { bar: 0.9, nightlife: 1.0, entertainment: 0.7 }
    };

    let period = 'afternoon';
    if (currentHour >= 6 && currentHour < 12) period = 'morning';
    else if (currentHour >= 18 && currentHour < 22) period = 'evening';
    else if (currentHour >= 22 || currentHour < 6) period = 'night';

    return timeRelevance[period][poi.category] || 0.5;
  }

  calculatePOIQuality(poi) {
    let score = 0.5;

    // Rating contribution
    if (poi.rating) {
      score += (poi.rating - 3) / 4; // Normalize 3-5 to 0-0.5
    }

    // Review count (more reviews = more reliable)
    if (poi.reviewCount) {
      const reviewScore = Math.min(poi.reviewCount / 100, 1) * 0.3;
      score += reviewScore;
    }

    // Popularity score
    if (poi.popularityScore) {
      score += poi.popularityScore * 0.2;
    }

    return Math.min(1, score);
  }

  calculateWeatherRelevance(poi, weather) {
    if (!weather) return 0.5;

    const weatherRelevance = {
      sunny: { park: 0.9, outdoor: 0.9, nature: 0.9, attraction: 0.8 },
      rainy: { museum: 0.9, shopping: 0.8, cafe: 0.8, restaurant: 0.7 },
      cloudy: { museum: 0.7, shopping: 0.6, park: 0.6 },
      cold: { cafe: 0.8, museum: 0.8, shopping: 0.7 },
      hot: { cafe: 0.8, shopping: 0.8, museum: 0.7 }
    };

    return weatherRelevance[weather]?.[poi.category] || 0.5;
  }

  createNotificationPayload(poi, context, relevanceScore) {
    const title = this.generateNotificationTitle(poi, context);
    const body = this.generateNotificationBody(poi, context, relevanceScore);

    return {
      notification: {
        title,
        body,
        icon: 'ic_notification',
        sound: 'default',
        click_action: 'OPEN_POI'
      },
      data: {
        type: 'poi_suggestion',
        poi_id: poi.id.toString(),
        category: poi.category,
        relevance_score: relevanceScore.toString(),
        deep_link: `aitravel://poi/${poi.id}`,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'poi_suggestions',
          priority: 'high',
          default_sound: true,
          default_vibrate_timings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };
  }

  generateNotificationTitle(poi, context) {
    const titles = [
      `${poi.name} nearby`,
      `Discover ${poi.name}`,
      `Hidden gem: ${poi.name}`,
      `Perfect for you: ${poi.name}`,
      `${poi.category} recommendation`
    ];

    // Context-specific titles
    if (context.mood === 'hungry') {
      return `Great ${poi.category} nearby: ${poi.name}`;
    }
    if (context.timeOfDay === 'morning' && poi.category === 'cafe') {
      return `Perfect morning spot: ${poi.name}`;
    }

    return titles[Math.floor(Math.random() * titles.length)];
  }

  generateNotificationBody(poi, context, relevanceScore) {
    let body = '';

    // Distance and time
    if (context.userLocation) {
      const distance = this.calculateDistance(
        context.userLocation.latitude,
        context.userLocation.longitude,
        poi.latitude,
        poi.longitude
      );
      
      if (distance < 1) {
        body += `Just ${Math.round(distance * 1000)}m away`;
      } else {
        body += `${distance.toFixed(1)}km away`;
      }
    }

    // Rating
    if (poi.rating) {
      body += ` • ${poi.rating}⭐`;
    }

    // Context-specific additions
    if (poi.category === 'restaurant' && context.timeOfDay === 'evening') {
      body += ' • Perfect for dinner';
    }
    if (poi.isOpenNow && poi.isOpenNow()) {
      body += ' • Open now';
    }

    return body || `Check out this ${poi.category}`;
  }

  async sendFCMNotification(fcmToken, payload) {
    try {
      const message = {
        token: fcmToken,
        ...payload
      };

      const response = await admin.messaging().send(message);
      logger.info('FCM notification sent successfully:', response);
      return response;
    } catch (error) {
      logger.error('FCM notification failed:', error);
      throw error;
    }
  }

  canSendNotification(userId) {
    // Check quiet hours
    if (this.isQuietHour()) return false;

    // Check notification frequency
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const userHistory = this.userNotificationHistory.get(userId) || [];
    
    // Clean old notifications (older than 1 hour)
    const recentNotifications = userHistory.filter(time => now - time < oneHour);
    this.userNotificationHistory.set(userId, recentNotifications);

    return recentNotifications.length < this.maxNotificationsPerHour;
  }

  isQuietHour() {
    const hour = new Date().getHours();
    return hour >= this.quietHours.start || hour < this.quietHours.end;
  }

  trackNotificationSent(userId) {
    const userHistory = this.userNotificationHistory.get(userId) || [];
    userHistory.push(Date.now());
    this.userNotificationHistory.set(userId, userHistory);
  }

  rescheduleForMorning(notificationId) {
    const notification = this.notificationQueue.get(notificationId);
    if (!notification) return;

    // Schedule for 8 AM next day
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const delay = tomorrow.getTime() - Date.now();
    
    setTimeout(() => {
      this.sendScheduledNotification(notificationId);
    }, delay);

    logger.info(`Notification rescheduled for morning: ${notification.poi.name}`);
  }

  async getUserWithDNA(userId) {
    const User = require('../models/User');
    return await User.findByPk(userId, {
      include: [{
        model: TravelDNA,
        as: 'travelDNA'
      }]
    });
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Geofencing trigger
  async onLocationUpdate(userId, newLocation, oldLocation) {
    try {
      // Find POIs within city radius (50-100km)
      const nearbyPOIs = await POI.findNearby(
        newLocation.latitude,
        newLocation.longitude,
        75, // 75km radius for city-wide coverage
        { limit: 20 }
      );

      // Get user's Travel DNA
      const user = await this.getUserWithDNA(userId);
      if (!user?.TravelDNA) return;

      // Score and filter POIs
      const relevantPOIs = [];
      for (const poi of nearbyPOIs) {
        const compatibility = user.TravelDNA.isCompatibleWith(poi);
        if (compatibility.score > 0.6) {
          relevantPOIs.push({ poi, score: compatibility.score });
        }
      }

      // Sort by relevance and select top 3
      relevantPOIs.sort((a, b) => b.score - a.score);
      const topPOIs = relevantPOIs.slice(0, 3);

      // Schedule notifications for top POIs
      for (const { poi } of topPOIs) {
        await this.scheduleContextualNotification(userId, poi, {
          userLocation: newLocation,
          timeOfDay: this.getTimeOfDay(),
          trigger: 'location_update'
        });
      }

    } catch (error) {
      logger.error('Error processing location update for notifications:', error);
    }
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }
}

module.exports = new NotificationService();
