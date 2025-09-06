const express = require('express');
const {
  updateFCMToken,
  sendTestNotification,
  getNotificationSettings,
  updateNotificationSettings,
  scheduleLocationNotification,
  getNotificationHistory,
  markNotificationRead,
  getNotificationStats,
  enableGeofencing,
  disableGeofencing,
  processLocationTrigger
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { dynamicUserLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and rate limiting
router.use(protect);
router.use(dynamicUserLimiter);

// FCM Token management
router.post('/token', updateFCMToken);
router.post('/test', sendTestNotification);

// Notification settings
router.get('/settings', getNotificationSettings);
router.put('/settings', updateNotificationSettings);

// Location-based notifications
router.post('/schedule', scheduleLocationNotification);
router.post('/location-trigger', processLocationTrigger);

// Geofencing
router.post('/geofence/enable', enableGeofencing);
router.post('/geofence/disable', disableGeofencing);

// History and analytics
router.get('/history', getNotificationHistory);
router.post('/:notificationId/read', markNotificationRead);
router.get('/stats', getNotificationStats);

module.exports = router;
