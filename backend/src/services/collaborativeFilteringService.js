const { sequelize } = require('../config/database');
const { logger } = require('../config/database');
const cacheService = require('./cacheService');

class CollaborativeFilteringService {
  constructor() {
    this.userSimilarityCache = new Map();
    this.itemSimilarityCache = new Map();
    this.minInteractions = 5;
    this.maxSimilarUsers = 50;
  }

  async generateRecommendations(userId, options = {}) {
    try {
      const {
        limit = 20,
        category = null,
        location = null,
        radius = 50,
        excludeVisited = true
      } = options;

      // Get user's interaction history
      const userInteractions = await this.getUserInteractions(userId);
      
      if (userInteractions.length < this.minInteractions) {
        logger.info(`User ${userId} has insufficient interactions for collaborative filtering`);
        return await this.getFallbackRecommendations(userId, options);
      }

      // Find similar users
      const similarUsers = await this.findSimilarUsers(userId, userInteractions);
      
      if (similarUsers.length === 0) {
        return await this.getFallbackRecommendations(userId, options);
      }

      // Generate recommendations based on similar users
      const recommendations = await this.generateUserBasedRecommendations(
        userId, 
        similarUsers, 
        options
      );

      // Combine with item-based recommendations
      const itemBasedRecs = await this.generateItemBasedRecommendations(
        userId,
        userInteractions,
        options
      );

      // Merge and rank recommendations
      const mergedRecs = this.mergeRecommendations(recommendations, itemBasedRecs);
      
      // Apply location filtering if specified
      let filteredRecs = mergedRecs;
      if (location) {
        filteredRecs = await this.filterByLocation(mergedRecs, location, radius);
      }

      // Apply category filtering
      if (category) {
        filteredRecs = filteredRecs.filter(rec => rec.category === category);
      }

      // Exclude already visited places
      if (excludeVisited) {
        const visitedPOIs = await this.getVisitedPOIs(userId);
        filteredRecs = filteredRecs.filter(rec => !visitedPOIs.includes(rec.id));
      }

      return filteredRecs.slice(0, limit);

    } catch (error) {
      logger.error('Error generating collaborative filtering recommendations:', error);
      return await this.getFallbackRecommendations(userId, options);
    }
  }

  async getUserInteractions(userId) {
    try {
      const query = `
        SELECT 
          JSON_EXTRACT(payload, '$.itemId') as poi_id,
          JSON_EXTRACT(payload, '$.feedback') as feedback,
          JSON_EXTRACT(payload, '$.context.rating') as rating,
          created_at
        FROM user_activity_logs 
        WHERE user_id = ? 
          AND event = 'feedback'
          AND JSON_EXTRACT(payload, '$.itemType') = 'poi'
          AND created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
        ORDER BY created_at DESC
      `;

      const interactions = await sequelize.query(query, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      // Convert feedback to numerical scores
      return interactions.map(interaction => ({
        poiId: parseInt(interaction.poi_id),
        score: this.feedbackToScore(interaction.feedback, interaction.rating),
        timestamp: interaction.created_at
      })).filter(interaction => interaction.score > 0);

    } catch (error) {
      logger.error('Error getting user interactions:', error);
      return [];
    }
  }

  feedbackToScore(feedback, rating = null) {
    const feedbackScores = {
      'visit': 5,
      'save': 4,
      'like': 3,
      'share': 3,
      'skip': 1,
      'dislike': 0,
      'not_interested': 0
    };

    let score = feedbackScores[feedback] || 2;
    
    // Incorporate explicit rating if available
    if (rating && rating > 0) {
      score = (score + rating) / 2;
    }

    return score;
  }

  async findSimilarUsers(userId, userInteractions) {
    try {
      // Check cache first
      const cacheKey = `similar_users:${userId}`;
      let similarUsers = await cacheService.get(cacheKey);
      
      if (similarUsers) {
        return similarUsers;
      }

      // Get POI IDs that the user has interacted with
      const userPOIs = userInteractions.map(i => i.poiId);
      
      if (userPOIs.length === 0) return [];

      // Find users who have interacted with similar POIs
      const query = `
        SELECT 
          user_id,
          JSON_EXTRACT(payload, '$.itemId') as poi_id,
          JSON_EXTRACT(payload, '$.feedback') as feedback,
          JSON_EXTRACT(payload, '$.context.rating') as rating
        FROM user_activity_logs 
        WHERE user_id != ?
          AND event = 'feedback'
          AND JSON_EXTRACT(payload, '$.itemType') = 'poi'
          AND JSON_EXTRACT(payload, '$.itemId') IN (${userPOIs.map(() => '?').join(',')})
          AND created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
      `;

      const otherUserInteractions = await sequelize.query(query, {
        replacements: [userId, ...userPOIs],
        type: sequelize.QueryTypes.SELECT
      });

      // Group by user and calculate similarity
      const userSimilarities = this.calculateUserSimilarities(
        userInteractions,
        otherUserInteractions
      );

      // Sort by similarity and take top users
      similarUsers = userSimilarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, this.maxSimilarUsers);

      // Cache for 2 hours
      await cacheService.set(cacheKey, similarUsers, 7200);

      return similarUsers;

    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  calculateUserSimilarities(userInteractions, otherUserInteractions) {
    const userScores = new Map();
    userInteractions.forEach(interaction => {
      userScores.set(interaction.poiId, interaction.score);
    });

    // Group other users' interactions
    const otherUsers = new Map();
    otherUserInteractions.forEach(interaction => {
      const userId = interaction.user_id;
      const poiId = parseInt(interaction.poi_id);
      const score = this.feedbackToScore(interaction.feedback, interaction.rating);

      if (!otherUsers.has(userId)) {
        otherUsers.set(userId, new Map());
      }
      otherUsers.get(userId).set(poiId, score);
    });

    // Calculate cosine similarity for each user
    const similarities = [];
    
    for (const [otherUserId, otherUserScores] of otherUsers) {
      if (otherUserScores.size < 3) continue; // Skip users with too few interactions

      const similarity = this.cosineSimilarity(userScores, otherUserScores);
      
      if (similarity > 0.1) { // Minimum similarity threshold
        similarities.push({
          userId: otherUserId,
          similarity,
          commonPOIs: this.getCommonPOIs(userScores, otherUserScores).length
        });
      }
    }

    return similarities;
  }

  cosineSimilarity(scoresA, scoresB) {
    const commonPOIs = this.getCommonPOIs(scoresA, scoresB);
    
    if (commonPOIs.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const poiId of commonPOIs) {
      const scoreA = scoresA.get(poiId);
      const scoreB = scoresB.get(poiId);
      
      dotProduct += scoreA * scoreB;
      normA += scoreA * scoreA;
      normB += scoreB * scoreB;
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getCommonPOIs(scoresA, scoresB) {
    const common = [];
    for (const poiId of scoresA.keys()) {
      if (scoresB.has(poiId)) {
        common.push(poiId);
      }
    }
    return common;
  }

  async generateUserBasedRecommendations(userId, similarUsers, options) {
    try {
      const recommendations = new Map();
      
      for (const similarUser of similarUsers) {
        // Get POIs that similar user liked but current user hasn't interacted with
        const query = `
          SELECT 
            JSON_EXTRACT(payload, '$.itemId') as poi_id,
            JSON_EXTRACT(payload, '$.feedback') as feedback,
            JSON_EXTRACT(payload, '$.context.rating') as rating
          FROM user_activity_logs 
          WHERE user_id = ?
            AND event = 'feedback'
            AND JSON_EXTRACT(payload, '$.itemType') = 'poi'
            AND JSON_EXTRACT(payload, '$.feedback') IN ('like', 'save', 'visit', 'share')
            AND JSON_EXTRACT(payload, '$.itemId') NOT IN (
              SELECT JSON_EXTRACT(payload, '$.itemId')
              FROM user_activity_logs
              WHERE user_id = ? AND event = 'feedback'
            )
        `;

        const userRecs = await sequelize.query(query, {
          replacements: [similarUser.userId, userId],
          type: sequelize.QueryTypes.SELECT
        });

        // Weight recommendations by user similarity
        for (const rec of userRecs) {
          const poiId = parseInt(rec.poi_id);
          const score = this.feedbackToScore(rec.feedback, rec.rating);
          const weightedScore = score * similarUser.similarity;

          if (recommendations.has(poiId)) {
            recommendations.set(poiId, recommendations.get(poiId) + weightedScore);
          } else {
            recommendations.set(poiId, weightedScore);
          }
        }
      }

      // Convert to array and get POI details
      const sortedRecs = Array.from(recommendations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50); // Top 50 candidates

      return await this.enrichRecommendations(sortedRecs, 'user_based');

    } catch (error) {
      logger.error('Error generating user-based recommendations:', error);
      return [];
    }
  }

  async generateItemBasedRecommendations(userId, userInteractions, options) {
    try {
      const recommendations = new Map();
      
      // Get user's highly rated POIs
      const likedPOIs = userInteractions
        .filter(interaction => interaction.score >= 4)
        .map(interaction => interaction.poiId);

      for (const poiId of likedPOIs) {
        // Find similar POIs
        const similarPOIs = await this.findSimilarPOIs(poiId);
        
        for (const similarPOI of similarPOIs) {
          if (recommendations.has(similarPOI.poiId)) {
            recommendations.set(similarPOI.poiId, 
              recommendations.get(similarPOI.poiId) + similarPOI.similarity);
          } else {
            recommendations.set(similarPOI.poiId, similarPOI.similarity);
          }
        }
      }

      // Convert to array and sort
      const sortedRecs = Array.from(recommendations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30); // Top 30 candidates

      return await this.enrichRecommendations(sortedRecs, 'item_based');

    } catch (error) {
      logger.error('Error generating item-based recommendations:', error);
      return [];
    }
  }

  async findSimilarPOIs(poiId) {
    try {
      // Check cache first
      const cacheKey = `similar_pois:${poiId}`;
      let similarPOIs = await cacheService.get(cacheKey);
      
      if (similarPOIs) {
        return similarPOIs;
      }

      // Find POIs that users who liked this POI also liked
      const query = `
        SELECT 
          JSON_EXTRACT(other_logs.payload, '$.itemId') as similar_poi_id,
          COUNT(*) as co_occurrence,
          AVG(CASE 
            WHEN JSON_EXTRACT(other_logs.payload, '$.feedback') IN ('like', 'save', 'visit') THEN 1 
            ELSE 0 
          END) as avg_rating
        FROM user_activity_logs main_logs
        JOIN user_activity_logs other_logs ON main_logs.user_id = other_logs.user_id
        WHERE main_logs.event = 'feedback'
          AND other_logs.event = 'feedback'
          AND JSON_EXTRACT(main_logs.payload, '$.itemId') = ?
          AND JSON_EXTRACT(other_logs.payload, '$.itemId') != ?
          AND JSON_EXTRACT(main_logs.payload, '$.feedback') IN ('like', 'save', 'visit')
          AND main_logs.created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
          AND other_logs.created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY similar_poi_id
        HAVING co_occurrence >= 3
        ORDER BY co_occurrence DESC, avg_rating DESC
        LIMIT 20
      `;

      const results = await sequelize.query(query, {
        replacements: [poiId, poiId],
        type: sequelize.QueryTypes.SELECT
      });

      similarPOIs = results.map(result => ({
        poiId: parseInt(result.similar_poi_id),
        similarity: result.co_occurrence * result.avg_rating / 10 // Normalize
      }));

      // Cache for 4 hours
      await cacheService.set(cacheKey, similarPOIs, 14400);

      return similarPOIs;

    } catch (error) {
      logger.error('Error finding similar POIs:', error);
      return [];
    }
  }

  async enrichRecommendations(recommendations, source) {
    try {
      const POI = require('../models/POI');
      const poiIds = recommendations.map(rec => rec[0]);
      
      if (poiIds.length === 0) return [];

      const pois = await POI.findAll({
        where: {
          id: poiIds
        }
      });

      const poiMap = new Map();
      pois.forEach(poi => poiMap.set(poi.id, poi));

      return recommendations
        .map(([poiId, score]) => {
          const poi = poiMap.get(poiId);
          if (!poi) return null;

          return {
            ...poi.toJSON(),
            collaborativeScore: score,
            recommendationSource: source
          };
        })
        .filter(rec => rec !== null);

    } catch (error) {
      logger.error('Error enriching recommendations:', error);
      return [];
    }
  }

  mergeRecommendations(userBasedRecs, itemBasedRecs) {
    const merged = new Map();
    
    // Add user-based recommendations with higher weight
    userBasedRecs.forEach(rec => {
      merged.set(rec.id, {
        ...rec,
        finalScore: rec.collaborativeScore * 0.7,
        sources: ['user_based']
      });
    });

    // Add item-based recommendations
    itemBasedRecs.forEach(rec => {
      if (merged.has(rec.id)) {
        const existing = merged.get(rec.id);
        existing.finalScore += rec.collaborativeScore * 0.3;
        existing.sources.push('item_based');
      } else {
        merged.set(rec.id, {
          ...rec,
          finalScore: rec.collaborativeScore * 0.3,
          sources: ['item_based']
        });
      }
    });

    // Convert to array and sort by final score
    return Array.from(merged.values())
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  async filterByLocation(recommendations, location, radius) {
    return recommendations.filter(rec => {
      if (!rec.latitude || !rec.longitude) return false;
      
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        rec.latitude,
        rec.longitude
      );
      
      return distance <= radius;
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

  async getVisitedPOIs(userId) {
    try {
      const query = `
        SELECT DISTINCT JSON_EXTRACT(payload, '$.itemId') as poi_id
        FROM user_activity_logs 
        WHERE user_id = ? 
          AND event = 'feedback'
          AND JSON_EXTRACT(payload, '$.feedback') = 'visit'
      `;

      const results = await sequelize.query(query, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      return results.map(result => parseInt(result.poi_id));

    } catch (error) {
      logger.error('Error getting visited POIs:', error);
      return [];
    }
  }

  async getFallbackRecommendations(userId, options) {
    try {
      // Get popular POIs as fallback
      const POI = require('../models/POI');
      const { limit = 20, category = null, location = null, radius = 50 } = options;

      let whereClause = {};
      if (category) {
        whereClause.category = category;
      }

      let pois = await POI.findAll({
        where: whereClause,
        order: [
          ['rating', 'DESC'],
          ['reviewCount', 'DESC']
        ],
        limit: limit * 2 // Get more to filter by location
      });

      // Filter by location if specified
      if (location) {
        pois = pois.filter(poi => {
          if (!poi.latitude || !poi.longitude) return false;
          
          const distance = this.calculateDistance(
            location.latitude,
            location.longitude,
            poi.latitude,
            poi.longitude
          );
          
          return distance <= radius;
        });
      }

      return pois.slice(0, limit).map(poi => ({
        ...poi.toJSON(),
        collaborativeScore: poi.rating / 5, // Normalize rating to 0-1
        recommendationSource: 'fallback_popular',
        finalScore: poi.rating / 5,
        sources: ['fallback']
      }));

    } catch (error) {
      logger.error('Error getting fallback recommendations:', error);
      return [];
    }
  }

  async updateUserProfile(userId, interactions) {
    try {
      // Update user's collaborative filtering profile
      const profile = {
        totalInteractions: interactions.length,
        averageRating: interactions.reduce((sum, i) => sum + i.score, 0) / interactions.length,
        topCategories: this.getTopCategories(interactions),
        lastUpdated: new Date().toISOString()
      };

      const cacheKey = `cf_profile:${userId}`;
      await cacheService.set(cacheKey, profile, 86400); // 24 hours

      return profile;

    } catch (error) {
      logger.error('Error updating user profile:', error);
      return null;
    }
  }

  getTopCategories(interactions) {
    // This would need POI data to determine categories
    // Simplified implementation
    return ['restaurant', 'attraction', 'activity'];
  }

  async getRecommendationStats(userId) {
    try {
      const userInteractions = await this.getUserInteractions(userId);
      const similarUsers = await this.findSimilarUsers(userId, userInteractions);

      return {
        userInteractions: userInteractions.length,
        similarUsers: similarUsers.length,
        canUseCollaborativeFiltering: userInteractions.length >= this.minInteractions,
        averageUserSimilarity: similarUsers.length > 0 ? 
          similarUsers.reduce((sum, u) => sum + u.similarity, 0) / similarUsers.length : 0
      };

    } catch (error) {
      logger.error('Error getting recommendation stats:', error);
      return {
        userInteractions: 0,
        similarUsers: 0,
        canUseCollaborativeFiltering: false,
        averageUserSimilarity: 0
      };
    }
  }
}

module.exports = new CollaborativeFilteringService();
