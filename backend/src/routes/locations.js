const express = require('express');
const {
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
  addFavoriteLocation,
  syncPOIsAroundLocation,
  getGeofenceRecommendations
} = require('../controllers/locationController');
const { protect } = require('../middleware/auth');
const { dynamicUserLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and rate limiting
router.use(protect);
router.use(dynamicUserLimiter);

// Location management
router.post('/update', updateLocation);
router.get('/current', getCurrentLocation);
router.get('/history', getLocationHistory);
router.post('/favorites', addFavoriteLocation);

// POI synchronization
router.post('/sync-pois', syncPOIsAroundLocation);

// Geofencing and proximity
router.get('/geofence-recommendations', getGeofenceRecommendations);

module.exports = router;
