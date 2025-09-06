const express = require('express');
const {
  chat,
  getConversationHistory,
  clearConversation,
  addPOIKnowledge,
  getChatbotStats,
  updateChatbotPersona,
  suggestQuestions
} = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication and rate limiting
router.use(protect);
router.use(aiLimiter);

// Chat endpoints
router.post('/chat', chat);
router.get('/history', getConversationHistory);
router.delete('/session', clearConversation);

// Knowledge management
router.post('/knowledge/poi', addPOIKnowledge);

// Persona and customization
router.put('/persona', updateChatbotPersona);
router.get('/suggestions', suggestQuestions);

// Stats and analytics
router.get('/stats', getChatbotStats);

module.exports = router;
