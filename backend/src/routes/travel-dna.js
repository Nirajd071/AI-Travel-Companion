const express = require('express');
const {
  createTravelDNA,
  getTravelDNA,
  updateTravelDNA,
  getQuizQuestions,
  analyzeTravelPersona
} = require('../controllers/travelDnaController');
const { protect } = require('../middleware/auth');
const { dynamicUserLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and rate limiting
router.use(protect);
router.use(dynamicUserLimiter);

// Quiz and DNA creation
router.get('/quiz', getQuizQuestions);
router.post('/', createTravelDNA);

// DNA management
router.get('/', getTravelDNA);
router.put('/', updateTravelDNA);

// Analysis
router.get('/analysis', analyzeTravelPersona);

module.exports = router;
