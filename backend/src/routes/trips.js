const express = require('express');
const {
  getAllTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  shareTrip,
  getTripAnalytics
} = require('../controllers/tripController');
const { protect } = require('../middleware/auth');
const { dynamicUserLimiter } = require('../middleware/rateLimiter');
const { performanceMonitor } = require('../middleware/monitoring');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);
router.use(dynamicUserLimiter);

// Trip CRUD operations
router.get('/', getAllTrips);
router.post('/', (req, res, next) => {
  performanceMonitor.trackTripCreation();
  next();
}, createTrip);

router.get('/analytics', getTripAnalytics);

router.route('/:id')
  .get(getTrip)
  .put(updateTrip)
  .delete(deleteTrip);

router.post('/:id/share', shareTrip);

module.exports = router;
