const { Client } = require('@elastic/elasticsearch');
const { logger } = require('../config/database');
const cacheService = require('./cacheService');

class VectorService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      }
    });
    
    this.indices = {
      pois: 'ai-travel-pois',
      conversations: 'ai-travel-conversations',
      user_profiles: 'ai-travel-user-profiles'
    };

    this.initializeIndices();
  }

  async initializeIndices() {
    try {
      // POI index for semantic search
      await this.createIndexIfNotExists(this.indices.pois, {
        mappings: {
          properties: {
            id: { type: 'integer' },
            name: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            category: { type: 'keyword' },
            location: { type: 'geo_point' },
            rating: { type: 'float' },
            price_level: { type: 'integer' },
            features: { type: 'keyword' },
            embedding: {
              type: 'dense_vector',
              dims: 384 // sentence-transformers dimension
            },
            created_at: { type: 'date' },
            updated_at: { type: 'date' }
          }
        }
      });

      // Conversation index for RAG
      await this.createIndexIfNotExists(this.indices.conversations, {
        mappings: {
          properties: {
            user_id: { type: 'integer' },
            session_id: { type: 'keyword' },
            message_type: { type: 'keyword' },
            content: { type: 'text', analyzer: 'standard' },
            context: { type: 'object' },
            embedding: {
              type: 'dense_vector',
              dims: 384
            },
            importance_score: { type: 'float' },
            timestamp: { type: 'date' }
          }
        }
      });

      // User profile index
      await this.createIndexIfNotExists(this.indices.user_profiles, {
        mappings: {
          properties: {
            user_id: { type: 'integer' },
            travel_dna: { type: 'object' },
            preferences: { type: 'object' },
            interaction_history: { type: 'object' },
            profile_embedding: {
              type: 'dense_vector',
              dims: 384
            },
            updated_at: { type: 'date' }
          }
        }
      });

      logger.info('Vector service indices initialized');

    } catch (error) {
      logger.error('Error initializing vector service indices:', error);
    }
  }

  async createIndexIfNotExists(indexName, settings) {
    try {
      const exists = await this.client.indices.exists({ index: indexName });
      
      if (!exists) {
        await this.client.indices.create({
          index: indexName,
          body: settings
        });
        logger.info(`Created index: ${indexName}`);
      }
    } catch (error) {
      logger.error(`Error creating index ${indexName}:`, error);
    }
  }

  // POI vector operations
  async indexPOI(poi, embedding) {
    try {
      await this.client.index({
        index: this.indices.pois,
        id: poi.id,
        body: {
          id: poi.id,
          name: poi.name,
          description: poi.description || '',
          category: poi.category,
          location: {
            lat: poi.latitude,
            lon: poi.longitude
          },
          rating: poi.rating || 0,
          price_level: poi.priceLevel || 0,
          features: poi.features || [],
          embedding: embedding,
          created_at: poi.createdAt || new Date(),
          updated_at: new Date()
        }
      });

      logger.debug(`Indexed POI: ${poi.name}`);
    } catch (error) {
      logger.error(`Error indexing POI ${poi.id}:`, error);
    }
  }

  async searchSimilarPOIs(queryEmbedding, options = {}) {
    try {
      const {
        size = 10,
        category = null,
        location = null,
        radius = null,
        minRating = 0,
        excludeIds = []
      } = options;

      let must = [{
        script_score: {
          query: { match_all: {} },
          script: {
            source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
            params: { query_vector: queryEmbedding }
          }
        }
      }];

      let filter = [];

      if (category) {
        filter.push({ term: { category } });
      }

      if (minRating > 0) {
        filter.push({ range: { rating: { gte: minRating } } });
      }

      if (excludeIds.length > 0) {
        filter.push({ 
          bool: { 
            must_not: { terms: { id: excludeIds } } 
          } 
        });
      }

      if (location && radius) {
        filter.push({
          geo_distance: {
            distance: `${radius}km`,
            location: {
              lat: location.latitude,
              lon: location.longitude
            }
          }
        });
      }

      const searchBody = {
        query: {
          bool: {
            must,
            filter: filter.length > 0 ? filter : undefined
          }
        },
        size,
        _source: {
          excludes: ['embedding']
        }
      };

      const response = await this.client.search({
        index: this.indices.pois,
        body: searchBody
      });

      return response.body.hits.hits.map(hit => ({
        ...hit._source,
        similarity_score: hit._score - 1.0 // Adjust for cosine similarity
      }));

    } catch (error) {
      logger.error('Error searching similar POIs:', error);
      return [];
    }
  }

  // Conversation vector operations for RAG
  async indexConversation(userId, sessionId, messageType, content, embedding, context = {}) {
    try {
      const docId = `${userId}_${sessionId}_${Date.now()}`;
      
      await this.client.index({
        index: this.indices.conversations,
        id: docId,
        body: {
          user_id: userId,
          session_id: sessionId,
          message_type: messageType,
          content: content,
          context: context,
          embedding: embedding,
          importance_score: this.calculateImportanceScore(content, messageType),
          timestamp: new Date()
        }
      });

      logger.debug(`Indexed conversation: ${messageType} for user ${userId}`);
    } catch (error) {
      logger.error('Error indexing conversation:', error);
    }
  }

  async searchRelevantConversations(userId, queryEmbedding, options = {}) {
    try {
      const {
        size = 5,
        sessionId = null,
        minImportance = 0.3,
        maxAge = 30 // days
      } = options;

      let filter = [
        { term: { user_id: userId } },
        { range: { importance_score: { gte: minImportance } } },
        { 
          range: { 
            timestamp: { 
              gte: `now-${maxAge}d` 
            } 
          } 
        }
      ];

      if (sessionId) {
        filter.push({ term: { session_id: sessionId } });
      }

      const response = await this.client.search({
        index: this.indices.conversations,
        body: {
          query: {
            bool: {
              must: [{
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    params: { query_vector: queryEmbedding }
                  }
                }
              }],
              filter
            }
          },
          size,
          _source: {
            excludes: ['embedding']
          },
          sort: [
            { _score: { order: 'desc' } },
            { importance_score: { order: 'desc' } },
            { timestamp: { order: 'desc' } }
          ]
        }
      });

      return response.body.hits.hits.map(hit => ({
        ...hit._source,
        relevance_score: hit._score - 1.0
      }));

    } catch (error) {
      logger.error('Error searching relevant conversations:', error);
      return [];
    }
  }

  calculateImportanceScore(content, messageType) {
    let score = 0.5; // Base score

    // Message type weights
    const typeWeights = {
      'user': 0.7,
      'assistant': 0.5,
      'system': 0.3
    };
    score *= typeWeights[messageType] || 0.5;

    // Content-based scoring
    const importantKeywords = [
      'like', 'love', 'hate', 'prefer', 'favorite', 'best', 'worst',
      'recommend', 'suggest', 'avoid', 'must', 'never',
      'restaurant', 'food', 'activity', 'place', 'visit'
    ];

    const contentLower = content.toLowerCase();
    const keywordMatches = importantKeywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;

    score += keywordMatches * 0.1;

    // Length bonus (longer messages often more informative)
    if (content.length > 100) score += 0.1;
    if (content.length > 200) score += 0.1;

    return Math.min(1.0, score);
  }

  // User profile vector operations
  async indexUserProfile(userId, travelDNA, preferences, profileEmbedding) {
    try {
      await this.client.index({
        index: this.indices.user_profiles,
        id: userId,
        body: {
          user_id: userId,
          travel_dna: travelDNA,
          preferences: preferences,
          profile_embedding: profileEmbedding,
          updated_at: new Date()
        }
      });

      logger.debug(`Indexed user profile: ${userId}`);
    } catch (error) {
      logger.error(`Error indexing user profile ${userId}:`, error);
    }
  }

  async findSimilarUsers(userEmbedding, options = {}) {
    try {
      const { size = 10, excludeUserId = null } = options;

      let filter = [];
      if (excludeUserId) {
        filter.push({ 
          bool: { 
            must_not: { term: { user_id: excludeUserId } } 
          } 
        });
      }

      const response = await this.client.search({
        index: this.indices.user_profiles,
        body: {
          query: {
            bool: {
              must: [{
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source: "cosineSimilarity(params.query_vector, 'profile_embedding') + 1.0",
                    params: { query_vector: userEmbedding }
                  }
                }
              }],
              filter: filter.length > 0 ? filter : undefined
            }
          },
          size,
          _source: {
            excludes: ['profile_embedding']
          }
        }
      });

      return response.body.hits.hits.map(hit => ({
        ...hit._source,
        similarity_score: hit._score - 1.0
      }));

    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  // Hybrid search combining text and vector similarity
  async hybridSearch(query, queryEmbedding, options = {}) {
    try {
      const {
        index = this.indices.pois,
        size = 10,
        textWeight = 0.3,
        vectorWeight = 0.7,
        filters = []
      } = options;

      const response = await this.client.search({
        index,
        body: {
          query: {
            bool: {
              should: [
                // Text search
                {
                  multi_match: {
                    query: query,
                    fields: ['name^2', 'description', 'category'],
                    boost: textWeight
                  }
                },
                // Vector search
                {
                  script_score: {
                    query: { match_all: {} },
                    script: {
                      source: `${vectorWeight} * (cosineSimilarity(params.query_vector, 'embedding') + 1.0)`,
                      params: { query_vector: queryEmbedding }
                    }
                  }
                }
              ],
              filter: filters,
              minimum_should_match: 1
            }
          },
          size,
          _source: {
            excludes: ['embedding']
          }
        }
      });

      return response.body.hits.hits.map(hit => ({
        ...hit._source,
        hybrid_score: hit._score
      }));

    } catch (error) {
      logger.error('Error performing hybrid search:', error);
      return [];
    }
  }

  // Batch operations
  async batchIndexPOIs(poisWithEmbeddings) {
    try {
      const body = [];
      
      for (const { poi, embedding } of poisWithEmbeddings) {
        body.push({ index: { _index: this.indices.pois, _id: poi.id } });
        body.push({
          id: poi.id,
          name: poi.name,
          description: poi.description || '',
          category: poi.category,
          location: {
            lat: poi.latitude,
            lon: poi.longitude
          },
          rating: poi.rating || 0,
          price_level: poi.priceLevel || 0,
          features: poi.features || [],
          embedding: embedding,
          created_at: poi.createdAt || new Date(),
          updated_at: new Date()
        });
      }

      if (body.length > 0) {
        const response = await this.client.bulk({ body });
        
        if (response.body.errors) {
          logger.error('Bulk indexing errors:', response.body.items.filter(item => item.index.error));
        } else {
          logger.info(`Batch indexed ${poisWithEmbeddings.length} POIs`);
        }
      }

    } catch (error) {
      logger.error('Error batch indexing POIs:', error);
    }
  }

  // Cleanup operations
  async deleteOldConversations(maxAge = 90) {
    try {
      await this.client.deleteByQuery({
        index: this.indices.conversations,
        body: {
          query: {
            range: {
              timestamp: {
                lt: `now-${maxAge}d`
              }
            }
          }
        }
      });

      logger.info(`Deleted conversations older than ${maxAge} days`);
    } catch (error) {
      logger.error('Error deleting old conversations:', error);
    }
  }

  async getIndexStats() {
    try {
      const stats = {};
      
      for (const [name, index] of Object.entries(this.indices)) {
        try {
          const response = await this.client.count({ index });
          stats[name] = {
            documentCount: response.body.count,
            indexName: index
          };
        } catch (error) {
          stats[name] = {
            documentCount: 0,
            error: error.message
          };
        }
      }

      return stats;
    } catch (error) {
      logger.error('Error getting index stats:', error);
      return {};
    }
  }

  // Health check
  async healthCheck() {
    try {
      const health = await this.client.cluster.health();
      return {
        status: health.body.status,
        cluster_name: health.body.cluster_name,
        number_of_nodes: health.body.number_of_nodes,
        indices: await this.getIndexStats()
      };
    } catch (error) {
      logger.error('Vector service health check failed:', error);
      return {
        status: 'red',
        error: error.message
      };
    }
  }
}

module.exports = new VectorService();
