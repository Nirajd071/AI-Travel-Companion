const axios = require('axios');
const POI = require('../models/POI');
const { logger } = require('../config/database');

class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://places.googleapis.com/v1';
    this.legacyBaseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  async findNearbyPlaces(latitude, longitude, radius = 5000, type = null) {
    try {
      const requestBody = {
        locationBias: {
          circle: {
            center: {
              latitude: latitude,
              longitude: longitude
            },
            radius: radius
          }
        },
        maxResultCount: 20
      };

      if (type) {
        requestBody.includedTypes = [type];
      }

      const response = await axios.post(`${this.baseUrl}/places:searchNearby`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.id'
        }
      });
      
      if (response.data.error) {
        throw new Error(`Google Places API error: ${response.data.error.message}`);
      }

      return response.data.places || [];
    } catch (error) {
      logger.error('Google Places API error:', error);
      throw error;
    }
  }

  async getPlaceDetails(placeId) {
    try {
      const params = {
        place_id: placeId,
        fields: 'name,formatted_address,geometry,rating,user_ratings_total,price_level,opening_hours,photos,website,formatted_phone_number,types',
        key: this.apiKey
      };

      const response = await axios.get(`${this.baseUrl}/details/json`, { params });
      
      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.result;
    } catch (error) {
      logger.error('Google Places details API error:', error);
      throw error;
    }
  }

  async searchPlaces(query, latitude, longitude, radius = 10000) {
    try {
      const requestBody = {
        textQuery: query,
        locationBias: {
          circle: {
            center: {
              latitude: latitude,
              longitude: longitude
            },
            radius: radius
          }
        },
        maxResultCount: 20
      };

      const response = await axios.post(`${this.baseUrl}/places:searchText`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.id'
        }
      });
      
      if (response.data.error) {
        throw new Error(`Google Places API error: ${response.data.error.message}`);
      }

      return response.data.places || [];
    } catch (error) {
      logger.error('Google Places search API error:', error);
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
              externalId: place.place_id,
              externalSource: 'google_places'
            }
          });

          if (existingPOI) {
            // Update existing POI
            await this.updatePOIFromGooglePlace(existingPOI, place);
            syncedPOIs.push(existingPOI);
          } else {
            // Create new POI
            const newPOI = await this.createPOIFromGooglePlace(place);
            syncedPOIs.push(newPOI);
          }
        } catch (error) {
          logger.error(`Error syncing POI ${place.place_id}:`, error);
        }
      }

      logger.info(`Synced ${syncedPOIs.length} POIs from Google Places`);
      return syncedPOIs;
    } catch (error) {
      logger.error('Error syncing POIs from Google Places:', error);
      throw error;
    }
  }

  async createPOIFromGooglePlace(place) {
    const category = this.mapGoogleTypeToCategory(place.types || []);
    const location = place.location;

    const poiData = {
      name: place.displayName?.text || place.name,
      description: place.formattedAddress || null,
      category,
      subcategory: place.types?.[0] || 'other',
      latitude: location.latitude,
      longitude: location.longitude,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      address: place.formattedAddress,
      rating: place.rating || null,
      reviewCount: place.userRatingCount || 0,
      priceLevel: place.priceLevel || null,
      externalId: place.id,
      externalSource: 'google_places',
      popularityScore: this.calculatePopularityScore(place),
      tags: place.types || [],
      images: [] // Photos require separate API call in new format
    };

    return await POI.create(poiData);
  }

  async updatePOIFromGooglePlace(poi, place) {
    const updateData = {
      name: place.name,
      rating: place.rating || poi.rating,
      reviewCount: place.user_ratings_total || poi.reviewCount,
      priceLevel: place.price_level || poi.priceLevel,
      popularityScore: this.calculatePopularityScore(place),
      lastUpdated: new Date()
    };

    return await poi.update(updateData);
  }

  mapGoogleTypeToCategory(types) {
    const typeMapping = {
      restaurant: 'restaurant',
      food: 'restaurant',
      meal_takeaway: 'restaurant',
      cafe: 'cafe',
      bar: 'bar',
      night_club: 'nightlife',
      tourist_attraction: 'attraction',
      museum: 'museum',
      park: 'park',
      amusement_park: 'entertainment',
      shopping_mall: 'shopping',
      store: 'shopping',
      lodging: 'hotel',
      subway_station: 'transport',
      bus_station: 'transport',
      church: 'religious',
      hindu_temple: 'religious',
      mosque: 'religious',
      synagogue: 'religious',
      art_gallery: 'cultural',
      library: 'cultural',
      movie_theater: 'entertainment',
      casino: 'entertainment',
      spa: 'entertainment',
      gym: 'entertainment',
      hospital: 'other',
      pharmacy: 'other'
    };

    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }

    return 'other';
  }

  calculatePopularityScore(place) {
    let score = 0.5; // Base score

    // Rating contribution (0-1)
    if (place.rating) {
      score += (place.rating - 3) / 4; // Normalize 3-5 to 0-0.5
    }

    // Review count contribution (0-0.3)
    const reviewCount = place.userRatingCount || place.user_ratings_total || 0;
    if (reviewCount) {
      const reviewScore = Math.min(reviewCount / 1000, 1) * 0.3;
      score += reviewScore;
    }

    // Price level contribution (budget places get slight boost)
    const priceLevel = place.priceLevel || place.price_level;
    if (priceLevel) {
      if (priceLevel <= 2) score += 0.1;
    }

    return Math.min(1, Math.max(0, score));
  }

  async enrichPOIWithDetails(poi) {
    try {
      if (!poi.externalId || poi.externalSource !== 'google_places') {
        return poi;
      }

      const details = await this.getPlaceDetails(poi.externalId);
      
      const updateData = {
        address: details.formatted_address || poi.address,
        phone: details.formatted_phone_number || poi.phone,
        website: details.website || poi.website,
        openingHours: details.opening_hours ? {
          weekday_text: details.opening_hours.weekday_text,
          periods: details.opening_hours.periods
        } : poi.openingHours,
        lastUpdated: new Date()
      };

      await poi.update(updateData);
      return poi;
    } catch (error) {
      logger.error(`Error enriching POI ${poi.id}:`, error);
      return poi;
    }
  }
}

module.exports = new GooglePlacesService();
