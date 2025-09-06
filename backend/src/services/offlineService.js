const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../config/database');
const cacheService = require('./cacheService');

class OfflineService {
  constructor() {
    this.offlineDataPath = path.join(__dirname, '../../data/offline');
    this.syncQueue = [];
    this.isOnline = true;
    this.lastSyncTime = null;
    this.offlineManifest = new Map();
    
    this.initializeOfflineStorage();
    this.setupNetworkMonitoring();
  }

  async initializeOfflineStorage() {
    try {
      await fs.mkdir(this.offlineDataPath, { recursive: true });
      
      // Create subdirectories for different data types
      const subdirs = ['pois', 'recommendations', 'maps', 'user_data', 'assets'];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.offlineDataPath, subdir), { recursive: true });
      }
      
      // Load existing offline manifest
      await this.loadOfflineManifest();
      
      logger.info('Offline storage initialized');
    } catch (error) {
      logger.error('Failed to initialize offline storage:', error);
    }
  }

  setupNetworkMonitoring() {
    // Monitor network connectivity
    setInterval(async () => {
      const wasOnline = this.isOnline;
      this.isOnline = await this.checkNetworkConnectivity();
      
      if (!wasOnline && this.isOnline) {
        logger.info('Network connectivity restored - starting sync');
        await this.syncOfflineData();
      } else if (wasOnline && !this.isOnline) {
        logger.warn('Network connectivity lost - switching to offline mode');
      }
    }, 30000); // Check every 30 seconds
  }

  async checkNetworkConnectivity() {
    try {
      // Simple connectivity check
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Core offline data management
  async storeOfflineData(type, id, data, priority = 'normal') {
    try {
      const filePath = path.join(this.offlineDataPath, type, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      // Update manifest
      this.offlineManifest.set(`${type}:${id}`, {
        type,
        id,
        filePath,
        timestamp: Date.now(),
        priority,
        size: JSON.stringify(data).length
      });
      
      await this.saveOfflineManifest();
      return true;
    } catch (error) {
      logger.error(`Failed to store offline data ${type}:${id}:`, error);
      return false;
    }
  }

  async getOfflineData(type, id) {
    try {
      const filePath = path.join(this.offlineDataPath, type, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.debug(`Offline data not found ${type}:${id}`);
      return null;
    }
  }

  async deleteOfflineData(type, id) {
    try {
      const filePath = path.join(this.offlineDataPath, type, `${id}.json`);
      await fs.unlink(filePath);
      this.offlineManifest.delete(`${type}:${id}`);
      await this.saveOfflineManifest();
      return true;
    } catch (error) {
      logger.error(`Failed to delete offline data ${type}:${id}:`, error);
      return false;
    }
  }

  // User-specific offline data
  async prepareUserOfflineData(userId, location, radius = 50) {
    try {
      logger.info(`Preparing offline data for user ${userId} within ${radius}km`);
      
      // Get user's Travel DNA
      const TravelDNA = require('../models/TravelDNA');
      const travelDNA = await TravelDNA.findOne({ where: { userId } });
      
      if (travelDNA) {
        await this.storeOfflineData('user_data', `travel_dna_${userId}`, travelDNA, 'high');
      }

      // Get nearby POIs
      const POI = require('../models/POI');
      const nearbyPOIs = await POI.findNearby(location.latitude, location.longitude, radius, {
        limit: 500 // Store more POIs for offline use
      });

      // Store POIs in batches
      const batchSize = 50;
      for (let i = 0; i < nearbyPOIs.length; i += batchSize) {
        const batch = nearbyPOIs.slice(i, i + batchSize);
        await this.storeOfflineData('pois', `batch_${userId}_${Math.floor(i / batchSize)}`, batch, 'high');
      }

      // Generate offline recommendations
      if (travelDNA) {
        const recommendations = await this.generateOfflineRecommendations(userId, nearbyPOIs, travelDNA);
        await this.storeOfflineData('recommendations', `user_${userId}`, recommendations, 'high');
      }

      // Store essential map data
      await this.prepareOfflineMapData(location, radius);

      logger.info(`Offline data prepared for user ${userId}: ${nearbyPOIs.length} POIs stored`);
      return true;

    } catch (error) {
      logger.error(`Failed to prepare offline data for user ${userId}:`, error);
      return false;
    }
  }

  async generateOfflineRecommendations(userId, pois, travelDNA) {
    const recommendations = {
      nearby: [],
      personalized: [],
      hidden_gems: [],
      categories: {}
    };

    // Score and categorize POIs
    for (const poi of pois) {
      const compatibility = travelDNA.isCompatibleWith(poi);
      
      if (compatibility.score > 0.7) {
        recommendations.personalized.push({
          ...poi.toJSON(),
          compatibilityScore: compatibility.score,
          reasons: compatibility.reasons
        });
      }

      if (poi.rating >= 4.0 && poi.reviewCount < 100) {
        recommendations.hidden_gems.push(poi.toJSON());
      }

      // Categorize by type
      if (!recommendations.categories[poi.category]) {
        recommendations.categories[poi.category] = [];
      }
      recommendations.categories[poi.category].push(poi.toJSON());
    }

    // Sort recommendations
    recommendations.personalized.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    recommendations.hidden_gems.sort((a, b) => b.rating - a.rating);
    recommendations.nearby = pois.slice(0, 20).map(poi => poi.toJSON());

    return recommendations;
  }

  async prepareOfflineMapData(location, radius) {
    // Store essential location data for offline maps
    const mapData = {
      center: location,
      radius,
      tiles: [], // Would contain map tile URLs/data
      boundaries: this.calculateBoundaries(location, radius),
      timestamp: Date.now()
    };

    await this.storeOfflineData('maps', `region_${location.latitude}_${location.longitude}`, mapData, 'medium');
  }

  calculateBoundaries(center, radiusKm) {
    const latDelta = radiusKm / 111; // Rough conversion: 1 degree lat ≈ 111 km
    const lngDelta = radiusKm / (111 * Math.cos(center.latitude * Math.PI / 180));

    return {
      north: center.latitude + latDelta,
      south: center.latitude - latDelta,
      east: center.longitude + lngDelta,
      west: center.longitude - lngDelta
    };
  }

  // Offline search and recommendations
  async searchOffline(userId, query, location) {
    try {
      const results = [];
      
      // Search in offline POI data
      const poiBatches = await this.getOfflinePOIBatches(userId);
      
      for (const batch of poiBatches) {
        const matches = batch.filter(poi => 
          poi.name.toLowerCase().includes(query.toLowerCase()) ||
          poi.category.toLowerCase().includes(query.toLowerCase()) ||
          (poi.description && poi.description.toLowerCase().includes(query.toLowerCase()))
        );
        results.push(...matches);
      }

      // Sort by relevance and distance
      if (location) {
        results.forEach(poi => {
          poi.distance = this.calculateDistance(location, {
            latitude: poi.latitude,
            longitude: poi.longitude
          });
        });
        results.sort((a, b) => a.distance - b.distance);
      }

      return results.slice(0, 20); // Return top 20 results

    } catch (error) {
      logger.error('Offline search failed:', error);
      return [];
    }
  }

  async getOfflineRecommendations(userId, type = 'personalized') {
    try {
      const recommendations = await this.getOfflineData('recommendations', `user_${userId}`);
      return recommendations ? recommendations[type] || [] : [];
    } catch (error) {
      logger.error('Failed to get offline recommendations:', error);
      return [];
    }
  }

  async getOfflinePOIBatches(userId) {
    const batches = [];
    let batchIndex = 0;
    
    while (true) {
      const batch = await this.getOfflineData('pois', `batch_${userId}_${batchIndex}`);
      if (!batch) break;
      batches.push(batch);
      batchIndex++;
    }
    
    return batches.flat();
  }

  // Sync operations
  async syncOfflineData() {
    if (!this.isOnline) {
      logger.warn('Cannot sync - offline mode');
      return false;
    }

    try {
      logger.info('Starting offline data sync');
      
      // Process sync queue
      await this.processSyncQueue();
      
      // Update last sync time
      this.lastSyncTime = Date.now();
      
      // Clean up old offline data
      await this.cleanupOfflineData();
      
      logger.info('Offline data sync completed');
      return true;

    } catch (error) {
      logger.error('Offline data sync failed:', error);
      return false;
    }
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;

    logger.info(`Processing ${this.syncQueue.length} sync operations`);
    
    const processed = [];
    const failed = [];

    for (const operation of this.syncQueue) {
      try {
        await this.processSyncOperation(operation);
        processed.push(operation);
      } catch (error) {
        logger.error('Sync operation failed:', error);
        operation.retries = (operation.retries || 0) + 1;
        
        if (operation.retries < 3) {
          failed.push(operation);
        }
      }
    }

    this.syncQueue = failed;
    logger.info(`Sync processed: ${processed.length} success, ${failed.length} failed`);
  }

  async processSyncOperation(operation) {
    switch (operation.type) {
      case 'upload_user_data':
        await this.syncUserDataToServer(operation.data);
        break;
      case 'download_poi_updates':
        await this.downloadPOIUpdates(operation.data);
        break;
      case 'sync_recommendations':
        await this.syncRecommendations(operation.data);
        break;
      default:
        throw new Error(`Unknown sync operation: ${operation.type}`);
    }
  }

  addToSyncQueue(type, data, priority = 'normal') {
    this.syncQueue.push({
      type,
      data,
      priority,
      timestamp: Date.now(),
      retries: 0
    });

    // Sort by priority
    this.syncQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Manifest management
  async loadOfflineManifest() {
    try {
      const manifestPath = path.join(this.offlineDataPath, 'manifest.json');
      const data = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(data);
      
      this.offlineManifest = new Map(Object.entries(manifest));
    } catch (error) {
      logger.debug('No existing offline manifest found');
      this.offlineManifest = new Map();
    }
  }

  async saveOfflineManifest() {
    try {
      const manifestPath = path.join(this.offlineDataPath, 'manifest.json');
      const manifest = Object.fromEntries(this.offlineManifest);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      logger.error('Failed to save offline manifest:', error);
    }
  }

  async cleanupOfflineData() {
    try {
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = Date.now();
      const toDelete = [];

      for (const [key, entry] of this.offlineManifest) {
        if (entry.priority !== 'high' && (now - entry.timestamp) > maxAge) {
          toDelete.push(key);
        }
      }

      for (const key of toDelete) {
        const [type, id] = key.split(':');
        await this.deleteOfflineData(type, id);
      }

      logger.info(`Cleaned up ${toDelete.length} old offline data entries`);

    } catch (error) {
      logger.error('Failed to cleanup offline data:', error);
    }
  }

  // Utility methods
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async getOfflineStats() {
    const stats = {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      totalEntries: this.offlineManifest.size,
      syncQueueSize: this.syncQueue.length,
      storageByType: {},
      totalSize: 0
    };

    for (const [key, entry] of this.offlineManifest) {
      if (!stats.storageByType[entry.type]) {
        stats.storageByType[entry.type] = { count: 0, size: 0 };
      }
      stats.storageByType[entry.type].count++;
      stats.storageByType[entry.type].size += entry.size || 0;
      stats.totalSize += entry.size || 0;
    }

    return stats;
  }

  // Public API methods
  async isDataAvailableOffline(type, id) {
    return this.offlineManifest.has(`${type}:${id}`);
  }

  async preloadUserData(userId, location, options = {}) {
    const radius = options.radius || 50;
    const priority = options.priority || 'high';
    
    return await this.prepareUserOfflineData(userId, location, radius);
  }

  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingSyncOperations: this.syncQueue.length
    };
  }
}

module.exports = new OfflineService();
