const Redis = require('redis');
const { logger } = require('../config/database');
const { performanceMonitor } = require('../middleware/monitoring');

class CacheService {
  constructor() {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    // Cache TTL configurations (in seconds)
    this.ttl = {
      poi: 3600,           // 1 hour
      recommendations: 1800, // 30 minutes
      userLocation: 300,    // 5 minutes
      travelDNA: 7200,     // 2 hours
      weatherData: 1800,   // 30 minutes
      placeDetails: 86400, // 24 hours
      userProfile: 3600,   // 1 hour
      searchResults: 900   // 15 minutes
    };

    // Offline storage for critical data
    this.offlineStorage = new Map();
    this.syncQueue = [];
  }

  async connect() {
    try {
      await this.redis.connect();
      logger.info('Cache service initialized');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
    }
  }

  // Generic cache operations
  async get(key, options = {}) {
    try {
      const startTime = Date.now();
      const data = await this.redis.get(key);
      
      performanceMonitor.trackCacheOperation('get', Date.now() - startTime, data ? 'hit' : 'miss');
      
      if (data) {
        return JSON.parse(data);
      }
      
      // Fallback to offline storage if Redis is down
      if (this.offlineStorage.has(key)) {
        logger.info(`Cache fallback to offline storage for key: ${key}`);
        return this.offlineStorage.get(key);
      }
      
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return this.offlineStorage.get(key) || null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const startTime = Date.now();
      const serialized = JSON.stringify(value);
      
      // Set in Redis with TTL
      if (ttl) {
        await this.redis.setEx(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      // Also store in offline storage for critical data
      if (this.isCriticalData(key)) {
        this.offlineStorage.set(key, value);
      }
      
      performanceMonitor.trackCacheOperation('set', Date.now() - startTime, 'success');
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      
      // Always store in offline storage as fallback
      this.offlineStorage.set(key, value);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      this.offlineStorage.delete(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      this.offlineStorage.delete(key);
      return false;
    }
  }

  async exists(key) {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      return this.offlineStorage.has(key);
    }
  }

  // POI caching
  async cachePOI(poi) {
    const key = `poi:${poi.id}`;
    return await this.set(key, poi, this.ttl.poi);
  }

  async getCachedPOI(poiId) {
    const key = `poi:${poiId}`;
    return await this.get(key);
  }

  async cachePOIList(location, radius, pois, filters = {}) {
    const filterKey = Object.keys(filters).sort().map(k => `${k}:${filters[k]}`).join('|');
    const key = `pois:${location.lat}:${location.lng}:${radius}:${filterKey}`;
    return await this.set(key, pois, this.ttl.poi);
  }

  async getCachedPOIList(location, radius, filters = {}) {
    const filterKey = Object.keys(filters).sort().map(k => `${k}:${filters[k]}`).join('|');
    const key = `pois:${location.lat}:${location.lng}:${radius}:${filterKey}`;
    return await this.get(key);
  }

  // Recommendations caching
  async cacheRecommendations(userId, type, recommendations, context = {}) {
    const contextKey = Object.keys(context).sort().map(k => `${k}:${context[k]}`).join('|');
    const key = `recommendations:${userId}:${type}:${contextKey}`;
    return await this.set(key, recommendations, this.ttl.recommendations);
  }

  async getCachedRecommendations(userId, type, context = {}) {
    const contextKey = Object.keys(context).sort().map(k => `${k}:${context[k]}`).join('|');
    const key = `recommendations:${userId}:${type}:${contextKey}`;
    return await this.get(key);
  }

  // User location caching
  async cacheUserLocation(userId, location) {
    const key = `location:${userId}`;
    return await this.set(key, location, this.ttl.userLocation);
  }

  async getCachedUserLocation(userId) {
    const key = `location:${userId}`;
    return await this.get(key);
  }

  // Travel DNA caching
  async cacheTravelDNA(userId, travelDNA) {
    const key = `travel_dna:${userId}`;
    return await this.set(key, travelDNA, this.ttl.travelDNA);
  }

  async getCachedTravelDNA(userId) {
    const key = `travel_dna:${userId}`;
    return await this.get(key);
  }

  // Weather data caching
  async cacheWeatherData(location, weatherData) {
    const key = `weather:${location.lat}:${location.lng}`;
    return await this.set(key, weatherData, this.ttl.weatherData);
  }

  async getCachedWeatherData(location) {
    const key = `weather:${location.lat}:${location.lng}`;
    return await this.get(key);
  }

  // Search results caching
  async cacheSearchResults(query, location, results) {
    const key = `search:${query}:${location.lat}:${location.lng}`;
    return await this.set(key, results, this.ttl.searchResults);
  }

  async getCachedSearchResults(query, location) {
    const key = `search:${query}:${location.lat}:${location.lng}`;
    return await this.get(key);
  }

  // Batch operations for offline sync
  async batchSet(items) {
    const pipeline = this.redis.multi();
    
    items.forEach(({ key, value, ttl }) => {
      const serialized = JSON.stringify(value);
      if (ttl) {
        pipeline.setEx(key, ttl, serialized);
      } else {
        pipeline.set(key, serialized);
      }
      
      // Store critical data in offline storage
      if (this.isCriticalData(key)) {
        this.offlineStorage.set(key, value);
      }
    });

    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Batch cache set error:', error);
      
      // Fallback to offline storage
      items.forEach(({ key, value }) => {
        this.offlineStorage.set(key, value);
      });
      return false;
    }
  }

  async batchGet(keys) {
    try {
      const pipeline = this.redis.multi();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      const data = {};
      
      keys.forEach((key, index) => {
        if (results[index][1]) {
          data[key] = JSON.parse(results[index][1]);
        } else if (this.offlineStorage.has(key)) {
          data[key] = this.offlineStorage.get(key);
        }
      });
      
      return data;
    } catch (error) {
      logger.error('Batch cache get error:', error);
      
      // Fallback to offline storage
      const data = {};
      keys.forEach(key => {
        if (this.offlineStorage.has(key)) {
          data[key] = this.offlineStorage.get(key);
        }
      });
      return data;
    }
  }

  // Cache invalidation
  async invalidateUserCache(userId) {
    const patterns = [
      `location:${userId}`,
      `travel_dna:${userId}`,
      `recommendations:${userId}:*`,
      `user_profile:${userId}`
    ];

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } else {
        await this.redis.del(pattern);
        this.offlineStorage.delete(pattern);
      }
    }
  }

  async invalidatePOICache(poiId) {
    const key = `poi:${poiId}`;
    await this.del(key);
    
    // Also invalidate related recommendation caches
    const keys = await this.redis.keys('recommendations:*');
    for (const cacheKey of keys) {
      const cached = await this.get(cacheKey);
      if (cached && cached.some(rec => rec.id === poiId)) {
        await this.del(cacheKey);
      }
    }
  }

  // Offline sync management
  addToSyncQueue(operation, data) {
    this.syncQueue.push({
      operation,
      data,
      timestamp: Date.now(),
      retries: 0
    });
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;

    logger.info(`Processing sync queue: ${this.syncQueue.length} items`);
    
    const processed = [];
    const failed = [];

    for (const item of this.syncQueue) {
      try {
        await this.processSyncItem(item);
        processed.push(item);
      } catch (error) {
        logger.error('Sync item failed:', error);
        item.retries++;
        
        if (item.retries < 3) {
          failed.push(item);
        } else {
          logger.error('Sync item exceeded max retries:', item);
        }
      }
    }

    // Update sync queue with failed items
    this.syncQueue = failed;
    
    logger.info(`Sync completed: ${processed.length} processed, ${failed.length} failed`);
  }

  async processSyncItem(item) {
    switch (item.operation) {
      case 'cache_poi':
        await this.cachePOI(item.data);
        break;
      case 'cache_recommendations':
        await this.cacheRecommendations(
          item.data.userId,
          item.data.type,
          item.data.recommendations,
          item.data.context
        );
        break;
      case 'invalidate_cache':
        await this.del(item.data.key);
        break;
      default:
        throw new Error(`Unknown sync operation: ${item.operation}`);
    }
  }

  // Utility methods
  isCriticalData(key) {
    const criticalPrefixes = ['travel_dna:', 'location:', 'user_profile:'];
    return criticalPrefixes.some(prefix => key.startsWith(prefix));
  }

  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbSize();
      
      return {
        connected: true,
        keyCount,
        memoryInfo: info,
        offlineStorageSize: this.offlineStorage.size,
        syncQueueSize: this.syncQueue.length
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        offlineStorageSize: this.offlineStorage.size,
        syncQueueSize: this.syncQueue.length
      };
    }
  }

  async warmupCache(userId) {
    try {
      // Pre-load frequently accessed data
      const User = require('../models/User');
      const TravelDNA = require('../models/TravelDNA');
      const UserLocation = require('../models/UserLocation');

      const [user, travelDNA, location] = await Promise.all([
        User.findByPk(userId),
        TravelDNA.findOne({ where: { userId } }),
        UserLocation.getCurrentLocation(userId)
      ]);

      if (user) {
        await this.set(`user_profile:${userId}`, user, this.ttl.userProfile);
      }
      
      if (travelDNA) {
        await this.cacheTravelDNA(userId, travelDNA);
      }
      
      if (location) {
        await this.cacheUserLocation(userId, location);
      }

      logger.info(`Cache warmed up for user ${userId}`);
    } catch (error) {
      logger.error(`Cache warmup failed for user ${userId}:`, error);
    }
  }
}

module.exports = new CacheService();
