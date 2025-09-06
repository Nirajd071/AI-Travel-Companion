const axios = require('axios');
const POI = require('../models/POI');
const { logger } = require('../config/database');

class FoursquareService {
  constructor() {
    this.apiKey = process.env.FOURSQUARE_API_KEY;
    this.baseUrl = 'https://api.foursquare.com/v3/places';
  }

  async findNearbyPlaces(latitude, longitude, radius = 5000, categories = null) {
    try {
      const params = {
        ll: `${latitude},${longitude}`,
        radius,
        limit: 50
      };

      if (categories) params.categories = categories;

      const response = await axios.get(`${this.baseUrl}/nearby`, {
        params,
        headers: {
          'Authorization': this.apiKey,
          'Accept': 'application/json'
        }
      });

      return response.data.results;
    } catch (error) {
      logger.error('Foursquare API error:', error);
      throw error;
    }
  }

  async getPlaceDetails(fsqId) {
    try {
      const response = await axios.get(`${this.baseUrl}/${fsqId}`, {
        params: {
          fields: 'name,location,categories,rating,stats,price,hours,website,tel,photos,description,tips'
        },
        headers: {
          'Authorization': this.apiKey,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Foursquare details API error:', error);
      throw error;
    }
  }

  async searchPlaces(query, latitude, longitude, radius = 10000) {
    try {
      const params = {
        query,
        ll: `${latitude},${longitude}`,
        radius,
        limit: 50
      };

      const response = await axios.get(`${this.baseUrl}/search`, {
        params,
        headers: {
          'Authorization': this.apiKey,
          'Accept': 'application/json'
        }
      });

      return response.data.results;
    } catch (error) {
      logger.error('Foursquare search API error:', error);
      throw error;
    }
  }

  async syncNearbyPOIs(latitude, longitude, radius = 5000) {
    try {
      const places = await this.findNearbyPlaces(latitude, longitude, radius);
      const syncedPOIs = [];

      for (const place of places) {
        try {
          // Check if POI already exists
          const existingPOI = await POI.findOne({
            where: {
              externalId: place.fsq_id,
              externalSource: 'foursquare'
            }
          });

          if (existingPOI) {
            // Update existing POI
            await this.updatePOIFromFoursquarePlace(existingPOI, place);
            syncedPOIs.push(existingPOI);
          } else {
            // Create new POI
            const newPOI = await this.createPOIFromFoursquarePlace(place);
            syncedPOIs.push(newPOI);
          }
        } catch (error) {
          logger.error(`Error syncing POI ${place.fsq_id}:`, error);
        }
      }

      logger.info(`Synced ${syncedPOIs.length} POIs from Foursquare`);
      return syncedPOIs;
    } catch (error) {
      logger.error('Error syncing POIs from Foursquare:', error);
      throw error;
    }
  }

  async createPOIFromFoursquarePlace(place) {
    const category = this.mapFoursquareCategoryToCategory(place.categories);
    const location = place.geocodes?.main || place.geocodes?.roof;

    if (!location) {
      throw new Error('No location data available for place');
    }

    const poiData = {
      name: place.name,
      description: place.description || null,
      category,
      subcategory: place.categories[0]?.name,
      latitude: location.latitude,
      longitude: location.longitude,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      address: this.formatAddress(place.location),
      city: place.location?.locality,
      country: place.location?.country,
      postalCode: place.location?.postcode,
      rating: place.rating ? place.rating / 2 : null, // Convert 0-10 to 0-5
      reviewCount: place.stats?.total_photos || 0,
      priceLevel: place.price || null,
      phone: place.tel,
      website: place.website,
      externalId: place.fsq_id,
      externalSource: 'foursquare',
      popularityScore: this.calculatePopularityScore(place),
      tags: place.categories?.map(cat => cat.name) || [],
      images: place.photos ? place.photos.slice(0, 5).map(photo => 
        `${photo.prefix}400x400${photo.suffix}`
      ) : []
    };

    return await POI.create(poiData);
  }

  async updatePOIFromFoursquarePlace(poi, place) {
    const updateData = {
      name: place.name,
      rating: place.rating ? place.rating / 2 : poi.rating,
      reviewCount: place.stats?.total_photos || poi.reviewCount,
      priceLevel: place.price || poi.priceLevel,
      popularityScore: this.calculatePopularityScore(place),
      lastUpdated: new Date()
    };

    return await poi.update(updateData);
  }

  mapFoursquareCategoryToCategory(categories) {
    if (!categories || categories.length === 0) return 'other';

    const categoryMapping = {
      // Food & Drink
      '13065': 'restaurant', // Restaurant
      '13032': 'bar', // Bar
      '13034': 'cafe', // Cafe
      '13040': 'nightlife', // Nightclub
      
      // Arts & Entertainment
      '10027': 'entertainment', // Entertainment
      '10019': 'museum', // Museum
      '10020': 'cultural', // Art Gallery
      '10021': 'entertainment', // Casino
      '10022': 'entertainment', // Comedy Club
      '10023': 'entertainment', // Concert Hall
      '10024': 'entertainment', // Movie Theater
      
      // Outdoors & Recreation
      '16000': 'park', // Outdoors & Recreation
      '16001': 'park', // Park
      '16002': 'nature', // Beach
      '16003': 'outdoor', // Campground
      '16004': 'outdoor', // Golf Course
      '16005': 'outdoor', // Gym / Fitness Center
      
      // Travel & Transport
      '19014': 'hotel', // Hotel
      '19015': 'hotel', // Bed & Breakfast
      '19016': 'hotel', // Resort
      '19040': 'transport', // Airport
      '19041': 'transport', // Bus Station
      '19042': 'transport', // Metro Station
      
      // Shops & Services
      '17000': 'shopping', // Retail
      '17001': 'shopping', // Shopping Mall
      '17002': 'shopping', // Department Store
      
      // Professional & Other Places
      '12000': 'religious', // Religious
      '12001': 'religious', // Church
      '12002': 'religious', // Temple
      '12003': 'religious', // Mosque
      
      // Landmarks
      '16000': 'attraction' // Landmark
    };

    for (const category of categories) {
      const mapped = categoryMapping[category.id];
      if (mapped) return mapped;
    }

    // Fallback to name-based mapping
    const firstCategory = categories[0].name.toLowerCase();
    if (firstCategory.includes('restaurant') || firstCategory.includes('food')) return 'restaurant';
    if (firstCategory.includes('bar') || firstCategory.includes('pub')) return 'bar';
    if (firstCategory.includes('cafe') || firstCategory.includes('coffee')) return 'cafe';
    if (firstCategory.includes('museum')) return 'museum';
    if (firstCategory.includes('park')) return 'park';
    if (firstCategory.includes('hotel')) return 'hotel';
    if (firstCategory.includes('shop') || firstCategory.includes('store')) return 'shopping';
    if (firstCategory.includes('church') || firstCategory.includes('temple')) return 'religious';

    return 'attraction';
  }

  formatAddress(location) {
    if (!location) return null;
    
    const parts = [
      location.address,
      location.locality,
      location.region,
      location.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  calculatePopularityScore(place) {
    let score = 0.5; // Base score

    // Rating contribution (0-0.4)
    if (place.rating) {
      score += (place.rating / 10) * 0.4; // Normalize 0-10 to 0-0.4
    }

    // Check-ins/photos contribution (0-0.3)
    if (place.stats?.total_photos) {
      const photoScore = Math.min(place.stats.total_photos / 100, 1) * 0.3;
      score += photoScore;
    }

    // Tips contribution (0-0.2)
    if (place.stats?.total_tips) {
      const tipScore = Math.min(place.stats.total_tips / 50, 1) * 0.2;
      score += tipScore;
    }

    // Price level contribution (budget places get slight boost)
    if (place.price && place.price <= 2) {
      score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  async enrichPOIWithDetails(poi) {
    try {
      if (!poi.externalId || poi.externalSource !== 'foursquare') {
        return poi;
      }

      const details = await this.getPlaceDetails(poi.externalId);
      
      const updateData = {
        description: details.description || poi.description,
        phone: details.tel || poi.phone,
        website: details.website || poi.website,
        openingHours: details.hours ? this.formatOpeningHours(details.hours) : poi.openingHours,
        features: details.features || poi.features,
        lastUpdated: new Date()
      };

      await poi.update(updateData);
      return poi;
    } catch (error) {
      logger.error(`Error enriching POI ${poi.id}:`, error);
      return poi;
    }
  }

  formatOpeningHours(hours) {
    if (!hours || !hours.regular) return null;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formatted = {};

    hours.regular.forEach(period => {
      const dayName = dayNames[period.day];
      formatted[period.day] = {
        day: dayName,
        open: period.open,
        close: period.close,
        closed: false
      };
    });

    return formatted;
  }

  // Get trending places in area
  async getTrendingPlaces(latitude, longitude, radius = 5000) {
    try {
      const params = {
        ll: `${latitude},${longitude}`,
        radius,
        sort: 'POPULARITY',
        limit: 20
      };

      const response = await axios.get(`${this.baseUrl}/nearby`, {
        params,
        headers: {
          'Authorization': this.apiKey,
          'Accept': 'application/json'
        }
      });

      return response.data.results;
    } catch (error) {
      logger.error('Foursquare trending places error:', error);
      throw error;
    }
  }
}

module.exports = new FoursquareService();
