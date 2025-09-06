const axios = require('axios');
const { logger } = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { performanceMonitor } = require('../middleware/monitoring');
const cacheService = require('../services/cacheService');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

exports.chat = catchAsync(async (req, res, next) => {
  const { message, context = {} } = req.body;
  const userId = req.user.id;

  if (!message || message.trim().length === 0) {
    return next(new AppError('Message is required', 400));
  }

  try {
    const startTime = Date.now();

    // Get cached conversation context if available
    const sessionId = context.sessionId || `session_${Date.now()}`;
    const cacheKey = `chat_context:${userId}:${sessionId}`;
    let conversationContext = await cacheService.get(cacheKey) || {};

    // Prepare context for AI service
    const aiContext = {
      ...context,
      sessionId,
      userId,
      location: conversationContext.lastLocation || context.location,
      timeOfDay: getTimeOfDay(),
      weather: conversationContext.lastWeather || context.weather,
      mood: context.mood || 'neutral'
    };

    // Call AI service
    const response = await axios.post(`${AI_SERVICE_URL}/chat`, {
      user_id: userId,
      message: message.trim(),
      context: aiContext
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data;

    // Update conversation context
    conversationContext = {
      ...conversationContext,
      lastMessage: message,
      lastResponse: aiResponse.response,
      lastLocation: aiContext.location,
      lastWeather: aiContext.weather,
      messageCount: (conversationContext.messageCount || 0) + 1,
      lastActivity: Date.now()
    };

    // Cache updated context
    await cacheService.set(cacheKey, conversationContext, 3600); // 1 hour TTL

    // Track performance
    const responseTime = Date.now() - startTime;
    performanceMonitor.trackAIRequest('chatbot', responseTime < 5000 ? 'success' : 'slow');

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse.response,
        sessionId: aiResponse.session_id || sessionId,
        context: {
          personaApplied: aiResponse.persona_applied || false,
          memoriesUsed: aiResponse.memories_used || 0,
          responseTime: responseTime
        },
        timestamp: aiResponse.timestamp || new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Chatbot error:', error);
    performanceMonitor.trackAIRequest('chatbot', 'error');

    // Fallback response
    const fallbackResponse = getFallbackResponse(message);
    
    res.status(200).json({
      success: true,
      data: {
        response: fallbackResponse,
        sessionId: context.sessionId || `session_${Date.now()}`,
        context: {
          personaApplied: false,
          memoriesUsed: 0,
          fallback: true
        },
        timestamp: new Date().toISOString()
      }
    });
  }
});

exports.getConversationHistory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { sessionId, limit = 20 } = req.query;

  try {
    const response = await axios.get(`${AI_SERVICE_URL}/chat/history`, {
      params: {
        user_id: userId,
        session_id: sessionId,
        limit
      },
      timeout: 10000
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error fetching conversation history:', error);
    
    res.status(200).json({
      success: true,
      data: {
        history: [],
        message: 'History temporarily unavailable'
      }
    });
  }
});

exports.clearConversation = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { sessionId } = req.body;

  try {
    // Clear from AI service
    await axios.delete(`${AI_SERVICE_URL}/chat/session`, {
      data: {
        user_id: userId,
        session_id: sessionId
      },
      timeout: 10000
    });

    // Clear cached context
    if (sessionId) {
      const cacheKey = `chat_context:${userId}:${sessionId}`;
      await cacheService.del(cacheKey);
    }

    res.status(200).json({
      success: true,
      message: 'Conversation cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing conversation:', error);
    return next(new AppError('Failed to clear conversation', 500));
  }
});

exports.addPOIKnowledge = catchAsync(async (req, res, next) => {
  const { poiId, description, tips } = req.body;

  if (!poiId) {
    return next(new AppError('POI ID is required', 400));
  }

  try {
    const POI = require('../models/POI');
    const poi = await POI.findByPk(poiId);

    if (!poi) {
      return next(new AppError('POI not found', 404));
    }

    // Add knowledge to AI service
    await axios.post(`${AI_SERVICE_URL}/knowledge/poi`, {
      poi_id: poiId,
      poi_name: poi.name,
      description: description || poi.description,
      tips: tips || ''
    }, {
      timeout: 10000
    });

    res.status(200).json({
      success: true,
      message: 'POI knowledge added successfully'
    });

  } catch (error) {
    logger.error('Error adding POI knowledge:', error);
    return next(new AppError('Failed to add POI knowledge', 500));
  }
});

exports.getChatbotStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const response = await axios.get(`${AI_SERVICE_URL}/stats/user/${userId}`, {
      timeout: 10000
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error fetching chatbot stats:', error);
    
    res.status(200).json({
      success: true,
      data: {
        totalConversations: 0,
        totalMessages: 0,
        averageResponseTime: 0,
        topTopics: [],
        message: 'Stats temporarily unavailable'
      }
    });
  }
});

exports.updateChatbotPersona = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { personality, preferences, communication_style } = req.body;

  try {
    await axios.put(`${AI_SERVICE_URL}/persona/${userId}`, {
      personality,
      preferences,
      communication_style
    }, {
      timeout: 10000
    });

    // Invalidate cached contexts to apply new persona
    const pattern = `chat_context:${userId}:*`;
    // Note: This would need Redis SCAN in production for pattern deletion
    
    res.status(200).json({
      success: true,
      message: 'Chatbot persona updated successfully'
    });

  } catch (error) {
    logger.error('Error updating chatbot persona:', error);
    return next(new AppError('Failed to update chatbot persona', 500));
  }
});

exports.suggestQuestions = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { context = {} } = req.query;

  try {
    const response = await axios.get(`${AI_SERVICE_URL}/suggestions`, {
      params: {
        user_id: userId,
        context: JSON.stringify(context)
      },
      timeout: 10000
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error getting question suggestions:', error);
    
    // Fallback suggestions
    const fallbackSuggestions = getFallbackSuggestions(context);
    
    res.status(200).json({
      success: true,
      data: {
        suggestions: fallbackSuggestions,
        fallback: true
      }
    });
  }
});

// Helper functions
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest')) {
    return "I'd be happy to help with recommendations! Could you tell me what type of place you're looking for and your current location?";
  }
  
  if (lowerMessage.includes('food') || lowerMessage.includes('restaurant') || lowerMessage.includes('eat')) {
    return "I can help you find great places to eat! What type of cuisine are you in the mood for?";
  }
  
  if (lowerMessage.includes('activity') || lowerMessage.includes('do') || lowerMessage.includes('visit')) {
    return "There are lots of interesting activities around! What kind of experience are you looking for - cultural, outdoor, entertainment, or something else?";
  }
  
  if (lowerMessage.includes('weather') || lowerMessage.includes('rain') || lowerMessage.includes('sunny')) {
    return "Weather can definitely affect travel plans! Let me know your location and I can suggest indoor or outdoor activities based on the conditions.";
  }
  
  return "I'm here to help you discover amazing places and experiences! Feel free to ask me about restaurants, activities, attractions, or anything travel-related.";
}

function getFallbackSuggestions(context) {
  const suggestions = [
    "What's a good restaurant nearby?",
    "Show me popular attractions in this area",
    "I'm looking for something fun to do",
    "What's the weather like for outdoor activities?"
  ];

  if (context.location) {
    suggestions.unshift(`What's interesting near ${context.location}?`);
  }

  const timeOfDay = getTimeOfDay();
  if (timeOfDay === 'morning') {
    suggestions.push("Where can I get a good breakfast?");
  } else if (timeOfDay === 'evening') {
    suggestions.push("Any good dinner spots you'd recommend?");
  }

  return suggestions.slice(0, 4);
}
