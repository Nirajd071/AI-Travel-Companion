const { sequelize } = require('../config/database');
const { logger } = require('../config/database');

class FeedbackService {
  constructor() {
    this.feedbackBuffer = new Map(); // Store feedback before batch processing
    this.batchSize = 10;
    this.batchTimeout = 30000; // 30 seconds
  }

  async recordUserFeedback(userId, itemId, itemType, feedback, context = {}) {
    try {
      const feedbackData = {
        userId,
        itemId,
        itemType, // 'poi', 'recommendation', 'trip', 'activity'
        feedback, // 'like', 'dislike', 'save', 'skip', 'visit', 'share'
        context: {
          timestamp: new Date().toISOString(),
          location: context.location,
          timeOfDay: context.timeOfDay,
          weather: context.weather,
          mood: context.mood,
          sessionId: context.sessionId
        },
        implicitSignals: this.extractImplicitSignals(context)
      };

      // Store in database immediately
      await this.storeFeedback(feedbackData);

      // Add to buffer for real-time adaptation
      const bufferKey = `${userId}_${itemType}`;
      if (!this.feedbackBuffer.has(bufferKey)) {
        this.feedbackBuffer.set(bufferKey, []);
      }
      this.feedbackBuffer.get(bufferKey).push(feedbackData);

      // Trigger real-time adaptation if buffer is full
      if (this.feedbackBuffer.get(bufferKey).length >= this.batchSize) {
        await this.processRealtimeAdaptation(userId, itemType);
      }

      // Update user preferences immediately for critical feedback
      if (['like', 'save', 'visit'].includes(feedback)) {
        await this.updateUserPreferences(userId, itemId, itemType, feedback);
      }

      return {
        success: true,
        adaptationTriggered: this.feedbackBuffer.get(bufferKey).length >= this.batchSize
      };

    } catch (error) {
      logger.error('Error recording user feedback:', error);
      throw error;
    }
  }

  async storeFeedback(feedbackData) {
    try {
      const query = `
        INSERT INTO user_activity_logs (
          user_id, event, payload, created_at
        ) VALUES (?, ?, ?, NOW())
      `;

      await sequelize.query(query, {
        replacements: [
          feedbackData.userId,
          'feedback',
          JSON.stringify(feedbackData)
        ]
      });

    } catch (error) {
      logger.error('Error storing feedback:', error);
      throw error;
    }
  }

  extractImplicitSignals(context) {
    const signals = {};

    // Dwell time analysis
    if (context.dwellTime) {
      signals.engagement = context.dwellTime > 30 ? 'high' : 
                          context.dwellTime > 10 ? 'medium' : 'low';
    }

    // Click depth
    if (context.clickDepth) {
      signals.interest = context.clickDepth > 3 ? 'high' : 
                        context.clickDepth > 1 ? 'medium' : 'low';
    }

    // Time to action
    if (context.timeToAction) {
      signals.decisiveness = context.timeToAction < 5 ? 'quick' : 
                            context.timeToAction < 15 ? 'moderate' : 'slow';
    }

    // Scroll behavior
    if (context.scrollPercentage) {
      signals.contentConsumption = context.scrollPercentage > 80 ? 'complete' : 
                                  context.scrollPercentage > 50 ? 'partial' : 'minimal';
    }

    return signals;
  }

  async updateUserPreferences(userId, itemId, itemType, feedback) {
    try {
      if (itemType === 'poi') {
        const POI = require('../models/POI');
        const TravelDNA = require('../models/TravelDNA');

        const poi = await POI.findByPk(itemId);
        const travelDNA = await TravelDNA.findOne({ where: { userId } });

        if (poi && travelDNA) {
          const categoryPrefs = { ...travelDNA.categoryPreferences };
          
          // Adjust category preference based on feedback
          const adjustment = this.getFeedbackAdjustment(feedback);
          categoryPrefs[poi.category] = Math.min(1, Math.max(0, 
            (categoryPrefs[poi.category] || 0.5) + adjustment
          ));

          // Update Travel DNA
          await travelDNA.update({
            categoryPreferences: categoryPrefs,
            lastUpdated: new Date()
          });

          logger.info(`Updated preferences for user ${userId}: ${poi.category} -> ${categoryPrefs[poi.category]}`);
        }
      }
    } catch (error) {
      logger.error('Error updating user preferences:', error);
    }
  }

  getFeedbackAdjustment(feedback) {
    const adjustments = {
      'like': 0.1,
      'save': 0.15,
      'visit': 0.2,
      'share': 0.1,
      'skip': -0.05,
      'dislike': -0.1,
      'not_interested': -0.15
    };
    return adjustments[feedback] || 0;
  }

  async processRealtimeAdaptation(userId, itemType) {
    try {
      const bufferKey = `${userId}_${itemType}`;
      const feedbackBatch = this.feedbackBuffer.get(bufferKey) || [];
      
      if (feedbackBatch.length === 0) return;

      // Analyze feedback patterns
      const patterns = this.analyzeFeedbackPatterns(feedbackBatch);
      
      // Update recommendation weights
      await this.updateRecommendationWeights(userId, patterns);
      
      // Clear processed feedback from buffer
      this.feedbackBuffer.set(bufferKey, []);
      
      logger.info(`Processed real-time adaptation for user ${userId}: ${feedbackBatch.length} feedback items`);

    } catch (error) {
      logger.error('Error processing real-time adaptation:', error);
    }
  }

  analyzeFeedbackPatterns(feedbackBatch) {
    const patterns = {
      categoryTrends: {},
      timeTrends: {},
      contextTrends: {},
      overallSentiment: 0
    };

    let totalSentiment = 0;
    const sentimentWeights = {
      'like': 1, 'save': 1.5, 'visit': 2, 'share': 1,
      'skip': -0.5, 'dislike': -1, 'not_interested': -1.5
    };

    feedbackBatch.forEach(feedback => {
      // Category trends
      if (feedback.itemType === 'poi') {
        const category = feedback.context.category;
        if (category) {
          patterns.categoryTrends[category] = (patterns.categoryTrends[category] || 0) + 
            sentimentWeights[feedback.feedback];
        }
      }

      // Time trends
      const hour = new Date(feedback.context.timestamp).getHours();
      const timeSlot = this.getTimeSlot(hour);
      patterns.timeTrends[timeSlot] = (patterns.timeTrends[timeSlot] || 0) + 
        sentimentWeights[feedback.feedback];

      // Context trends
      if (feedback.context.mood) {
        patterns.contextTrends[feedback.context.mood] = 
          (patterns.contextTrends[feedback.context.mood] || 0) + 
          sentimentWeights[feedback.feedback];
      }

      // Overall sentiment
      totalSentiment += sentimentWeights[feedback.feedback] || 0;
    });

    patterns.overallSentiment = totalSentiment / feedbackBatch.length;
    return patterns;
  }

  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  async updateRecommendationWeights(userId, patterns) {
    try {
      const TravelDNA = require('../models/TravelDNA');
      const travelDNA = await TravelDNA.findOne({ where: { userId } });
      
      if (!travelDNA) return;

      // Update category preferences based on patterns
      const categoryPrefs = { ...travelDNA.categoryPreferences };
      Object.entries(patterns.categoryTrends).forEach(([category, trend]) => {
        const adjustment = trend * 0.02; // Small incremental changes
        categoryPrefs[category] = Math.min(1, Math.max(0, 
          (categoryPrefs[category] || 0.5) + adjustment
        ));
      });

      // Update activity preferences based on time trends
      const activityPrefs = { ...travelDNA.activityPreferences };
      Object.entries(patterns.timeTrends).forEach(([timeSlot, trend]) => {
        activityPrefs[`${timeSlot}_preference`] = Math.min(1, Math.max(0, 
          (activityPrefs[`${timeSlot}_preference`] || 0.5) + (trend * 0.01)
        ));
      });

      // Update Travel DNA
      await travelDNA.update({
        categoryPreferences: categoryPrefs,
        activityPreferences: activityPrefs,
        lastUpdated: new Date()
      });

    } catch (error) {
      logger.error('Error updating recommendation weights:', error);
    }
  }

  async getBandits(userId, contextType = 'general') {
    try {
      // Simple multi-armed bandit implementation
      const query = `
        SELECT 
          JSON_EXTRACT(payload, '$.itemId') as item_id,
          JSON_EXTRACT(payload, '$.itemType') as item_type,
          JSON_EXTRACT(payload, '$.feedback') as feedback,
          COUNT(*) as total_interactions,
          SUM(CASE 
            WHEN JSON_EXTRACT(payload, '$.feedback') IN ('like', 'save', 'visit') THEN 1 
            ELSE 0 
          END) as positive_interactions
        FROM user_activity_logs 
        WHERE user_id = ? 
          AND event = 'feedback'
          AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY item_id, item_type
        HAVING total_interactions >= 3
      `;

      const results = await sequelize.query(query, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      // Calculate UCB1 scores for exploration vs exploitation
      const bandits = results.map(result => {
        const successRate = result.positive_interactions / result.total_interactions;
        const confidence = Math.sqrt((2 * Math.log(results.length)) / result.total_interactions);
        const ucb1Score = successRate + confidence;

        return {
          itemId: result.item_id,
          itemType: result.item_type,
          successRate,
          totalInteractions: result.total_interactions,
          ucb1Score,
          explorationBonus: confidence
        };
      });

      // Sort by UCB1 score for optimal exploration/exploitation balance
      bandits.sort((a, b) => b.ucb1Score - a.ucb1Score);

      return bandits;

    } catch (error) {
      logger.error('Error getting bandits:', error);
      return [];
    }
  }

  async getPersonalizedRanking(userId, candidates, context = {}) {
    try {
      // Get user's bandit scores
      const bandits = await this.getBandits(userId);
      const banditMap = new Map(bandits.map(b => [`${b.itemId}_${b.itemType}`, b]));

      // Get user's Travel DNA
      const TravelDNA = require('../models/TravelDNA');
      const travelDNA = await TravelDNA.findOne({ where: { userId } });

      // Score each candidate
      const scoredCandidates = candidates.map(candidate => {
        let score = 0.5; // Base score

        // Travel DNA compatibility (40%)
        if (travelDNA && candidate.category) {
          const categoryWeight = travelDNA.getCategoryWeight(candidate.category);
          score += categoryWeight * 0.4;
        }

        // Bandit score (30%)
        const banditKey = `${candidate.id}_${candidate.type || 'poi'}`;
        const banditData = banditMap.get(banditKey);
        if (banditData) {
          score += banditData.ucb1Score * 0.3;
        } else {
          // Exploration bonus for new items
          score += 0.15;
        }

        // Context relevance (20%)
        const contextScore = this.calculateContextRelevance(candidate, context);
        score += contextScore * 0.2;

        // Quality score (10%)
        const qualityScore = this.calculateQualityScore(candidate);
        score += qualityScore * 0.1;

        return {
          ...candidate,
          personalizedScore: Math.min(1, score),
          banditData: banditData || null
        };
      });

      // Sort by personalized score
      scoredCandidates.sort((a, b) => b.personalizedScore - a.personalizedScore);

      return scoredCandidates;

    } catch (error) {
      logger.error('Error getting personalized ranking:', error);
      return candidates; // Return original order on error
    }
  }

  calculateContextRelevance(candidate, context) {
    let score = 0.5;

    // Time relevance
    if (context.timeOfDay && candidate.category) {
      const timeRelevance = {
        morning: { cafe: 0.9, restaurant: 0.7, park: 0.8 },
        afternoon: { restaurant: 0.8, shopping: 0.9, attraction: 0.9 },
        evening: { restaurant: 0.9, bar: 0.9, entertainment: 0.9 },
        night: { bar: 0.9, nightlife: 1.0, entertainment: 0.7 }
      };
      score += (timeRelevance[context.timeOfDay]?.[candidate.category] || 0.5) * 0.3;
    }

    // Weather relevance
    if (context.weather && candidate.category) {
      const weatherRelevance = {
        sunny: { park: 0.9, outdoor: 0.9, nature: 0.9 },
        rainy: { museum: 0.9, shopping: 0.8, cafe: 0.8 },
        cold: { cafe: 0.8, museum: 0.8, shopping: 0.7 }
      };
      score += (weatherRelevance[context.weather]?.[candidate.category] || 0.5) * 0.2;
    }

    return Math.min(1, score);
  }

  calculateQualityScore(candidate) {
    let score = 0.5;

    if (candidate.rating) {
      score += (candidate.rating - 3) / 4; // Normalize 3-5 to 0-0.5
    }

    if (candidate.reviewCount) {
      const reviewScore = Math.min(candidate.reviewCount / 100, 1) * 0.3;
      score += reviewScore;
    }

    return Math.min(1, score);
  }
}

module.exports = new FeedbackService();
