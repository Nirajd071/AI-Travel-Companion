const express = require('express');
const {
  getNearbyRecommendations,
  getPersonalizedRecommendations,
  getHiddenGems
} = require('../controllers/recommendationController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and AI rate limiting
router.use(protect);
router.use(aiLimiter);

// Location-based recommendations (5-10 min radius)
router.get('/nearby', getNearbyRecommendations);

// Personalized recommendations based on Travel DNA + context
router.get('/personalized', getPersonalizedRecommendations);

// Hidden gems discovery
router.get('/hidden-gems', getHiddenGems);

// Category-specific endpoints
router.get('/restaurants', (req, res, next) => {
  req.query.category = 'restaurant';
  getNearbyRecommendations(req, res, next);
});

router.get('/activities', (req, res, next) => {
  req.query.category = 'attraction';
  getNearbyRecommendations(req, res, next);
});

router.get('/cafes', (req, res, next) => {
  req.query.category = 'cafe';
  getNearbyRecommendations(req, res, next);
});

module.exports = router;
