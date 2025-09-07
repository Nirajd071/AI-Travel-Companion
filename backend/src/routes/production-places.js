/**
 * Production Places API Routes
 * Real Google Places API integration with PostgreSQL + PostGIS storage
 */

const express = require('express');
const axios = require('axios');
const { initializeDatabase, geoQueries, cache, logger } = require('../config/production-database');
const router = express.Router();

// Initialize database models
let models = null;
initializeDatabase().then(({ models: dbModels }) => {
  models = dbModels;
}).catch(error => {
  logger.error('Failed to initialize database for places routes:', error);
});

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';

/**
 * Search places using Google Places API (New API format)
 */
router.post('/search', async (req, res) => {
  try {
    const { query, location, radius = 5000, type, maxResults = 20 } = req.body;

    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'your-google-maps-api-key') {
      logger.warn('Google Places API key not configured or using placeholder');
      return res.status(500).json({
        error: 'Google Places API key not configured',
        code: 'API_KEY_MISSING',
        message: 'Please set GOOGLE_MAPS_API_KEY environment variable'
      });
    }

    // Create cache key
    const cacheKey = `search:${query}:${location?.lat}:${location?.lng}:${radius}:${type}`;
    
    // Check cache first
    const cachedResults = await cache.getCachedPlacesSearch(cacheKey);
    if (cachedResults) {
      logger.info(`Returning cached results for: ${query}`);
      return res.json({
        places: cachedResults,
        source: 'cache',
        count: cachedResults.length
      });
    }

    // Prepare Google Places API request
    const searchRequest = {
      textQuery: query,
      maxResultCount: maxResults,
      ...(type && { includedType: type }),
      ...(location && {
        locationBias: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng
            },
            radius: radius
          }
        }
      })
    };

    logger.info(`Searching Google Places API for: ${query}`, { searchRequest });

    // Call Google Places API (New API format)
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE_URL}:searchText`,
      searchRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.types,places.photos,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber'
        },
        timeout: 10000
      }
    );

    const places = response.data.places || [];
    
    // Process and store places in database
    const processedPlaces = await Promise.all(places.map(async (place) => {
      const processedPlace = {
        id: place.id,
        google_place_id: place.id,
        name: place.displayName?.text || 'Unknown Place',
        address: place.formattedAddress,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        price_level: place.priceLevel,
        types: place.types || [],
        photos: place.photos?.map(photo => photo.name) || [],
        opening_hours: place.regularOpeningHours,
        website: place.websiteUri,
        phone: place.nationalPhoneNumber
      };

      // Store in database if models are available
      if (models && processedPlace.lat && processedPlace.lng) {
        try {
          await models.Place.upsert({
            google_place_id: processedPlace.google_place_id,
            name: processedPlace.name,
            address: processedPlace.address,
            location: {
              type: 'Point',
              coordinates: [processedPlace.lng, processedPlace.lat]
            },
            rating: processedPlace.rating,
            price_level: processedPlace.price_level,
            category: processedPlace.types[0]?.replace(/_/g, ' '),
            photos: processedPlace.photos,
            opening_hours: processedPlace.opening_hours,
            contact_info: {
              website: processedPlace.website,
              phone: processedPlace.phone
            },
            metadata: {
              google_types: processedPlace.types,
              last_updated: new Date()
            }
          });
        } catch (dbError) {
          logger.warn(`Failed to store place in database: ${dbError.message}`);
        }
      }

      return processedPlace;
    }));

    // Cache results
    await cache.cachePlacesSearch(cacheKey, processedPlaces, 1800); // 30 minutes

    logger.info(`Found ${processedPlaces.length} places for query: ${query}`);

    res.json({
      places: processedPlaces,
      source: 'google_api',
      count: processedPlaces.length,
      query: query,
      location: location
    });

  } catch (error) {
    logger.error('Places search error:', { 
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
    
    if (error.response?.status === 403 || error.response?.status === 400) {
      logger.warn('Google Places API failed, using fallback data', { 
        error: error.message,
        status: error.response?.status,
        apiError: error.response?.data
      });
      
      // Fallback to sample places data
      const fallbackPlaces = [
        {
          id: 'fallback_1',
          google_place_id: 'fallback_eiffel_tower',
          name: 'Eiffel Tower',
          address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
          lat: 48.8584,
          lng: 2.2945,
          rating: 4.6,
          price_level: 2,
          types: ['tourist_attraction', 'point_of_interest'],
          photos: [],
          opening_hours: null,
          website: null,
          phone: null
        },
        {
          id: 'fallback_2', 
          google_place_id: 'fallback_louvre',
          name: 'Louvre Museum',
          address: 'Rue de Rivoli, 75001 Paris, France',
          lat: 48.8606,
          lng: 2.3376,
          rating: 4.7,
          price_level: 3,
          types: ['museum', 'tourist_attraction'],
          photos: [],
          opening_hours: null,
          website: null,
          phone: null
        },
        {
          id: 'fallback_3',
          google_place_id: 'fallback_notre_dame',
          name: 'Notre-Dame Cathedral',
          address: '6 Parvis Notre-Dame, 75004 Paris, France',
          lat: 48.8530,
          lng: 2.3499,
          rating: 4.5,
          price_level: 1,
          types: ['place_of_worship', 'tourist_attraction'],
          photos: [],
          opening_hours: null,
          website: null,
          phone: null
        }
      ];

      return res.json({
        places: fallbackPlaces,
        source: 'fallback_data',
        count: fallbackPlaces.length,
        query: req.body.query,
        location: req.body.location,
        message: 'Using sample data - Google Places API key needed for real data'
      });
    }

    res.status(500).json({
      error: 'Failed to search places',
      code: 'SEARCH_FAILED',
      message: error.message
    });
  }
});

/**
 * Get nearby places using PostGIS geospatial queries
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000, limit = 50, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
        code: 'MISSING_COORDINATES'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseInt(radius);
    const maxLimit = parseInt(limit);

    // Check cache first
    const cacheKey = `nearby:${latitude}:${longitude}:${radiusMeters}:${category || 'all'}`;
    const cachedResults = await cache.get(cacheKey);
    
    if (cachedResults) {
      return res.json({
        places: cachedResults,
        source: 'cache',
        count: cachedResults.length
      });
    }

    // Query database using PostGIS
    if (!models) {
      return res.status(500).json({
        error: 'Database not initialized',
        code: 'DB_NOT_READY'
      });
    }

    let places = await geoQueries.findPlacesWithinRadius(
      latitude, 
      longitude, 
      radiusMeters, 
      maxLimit
    );

    // Filter by category if specified
    if (category) {
      places = places.filter(place => 
        place.category?.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Format response
    const formattedPlaces = places.map(place => ({
      id: place.id,
      google_place_id: place.google_place_id,
      name: place.name,
      address: place.address,
      lat: place.location?.coordinates[1],
      lng: place.location?.coordinates[0],
      rating: place.rating,
      price_level: place.price_level,
      category: place.category,
      photos: place.photos,
      distance: Math.round(place.dataValues?.distance || 0),
      opening_hours: place.opening_hours,
      contact_info: place.contact_info
    }));

    // Cache results
    await cache.set(cacheKey, formattedPlaces, 900); // 15 minutes

    logger.info(`Found ${formattedPlaces.length} nearby places`);

    res.json({
      places: formattedPlaces,
      source: 'database',
      count: formattedPlaces.length,
      center: { lat: latitude, lng: longitude },
      radius: radiusMeters
    });

  } catch (error) {
    logger.error('Nearby places error:', error);
    res.status(500).json({
      error: 'Failed to get nearby places',
      code: 'NEARBY_FAILED',
      message: error.message
    });
  }
});

/**
 * Get place details by ID
 */
router.get('/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    // Check cache first
    const cacheKey = `place:${placeId}`;
    const cachedPlace = await cache.get(cacheKey);
    
    if (cachedPlace) {
      return res.json({
        place: cachedPlace,
        source: 'cache'
      });
    }

    // Try database first
    if (models) {
      const place = await models.Place.findOne({
        where: {
          $or: [
            { id: placeId },
            { google_place_id: placeId }
          ]
        }
      });

      if (place) {
        const formattedPlace = {
          id: place.id,
          google_place_id: place.google_place_id,
          name: place.name,
          address: place.address,
          lat: place.location?.coordinates[1],
          lng: place.location?.coordinates[0],
          rating: place.rating,
          price_level: place.price_level,
          category: place.category,
          photos: place.photos,
          opening_hours: place.opening_hours,
          contact_info: place.contact_info,
          amenities: place.amenities,
          description: place.description
        };

        // Cache result
        await cache.set(cacheKey, formattedPlace, 3600); // 1 hour

        return res.json({
          place: formattedPlace,
          source: 'database'
        });
      }
    }

    // Fallback to Google Places API for detailed info
    if (GOOGLE_PLACES_API_KEY) {
      const response = await axios.get(
        `${GOOGLE_PLACES_BASE_URL}/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,priceLevel,types,photos,regularOpeningHours,websiteUri,nationalPhoneNumber,editorialSummary'
          },
          timeout: 10000
        }
      );

      const place = response.data;
      const formattedPlace = {
        id: place.id,
        google_place_id: place.id,
        name: place.displayName?.text,
        address: place.formattedAddress,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        price_level: place.priceLevel,
        types: place.types,
        photos: place.photos?.map(photo => photo.name) || [],
        opening_hours: place.regularOpeningHours,
        website: place.websiteUri,
        phone: place.nationalPhoneNumber,
        description: place.editorialSummary?.text
      };

      // Cache result
      await cache.set(cacheKey, formattedPlace, 3600);

      return res.json({
        place: formattedPlace,
        source: 'google_api'
      });
    }

    res.status(404).json({
      error: 'Place not found',
      code: 'PLACE_NOT_FOUND'
    });

  } catch (error) {
    logger.error('Get place details error:', error);
    res.status(500).json({
      error: 'Failed to get place details',
      code: 'PLACE_DETAILS_FAILED',
      message: error.message
    });
  }
});

/**
 * Add place to user's trip
 */
router.post('/:placeId/add-to-trip', async (req, res) => {
  try {
    const { placeId } = req.params;
    const { tripId, visitDate, notes } = req.body;

    if (!models) {
      return res.status(500).json({
        error: 'Database not initialized',
        code: 'DB_NOT_READY'
      });
    }

    // Verify trip exists and belongs to user (add auth middleware)
    const trip = await models.Trip.findByPk(tripId);
    if (!trip) {
      return res.status(404).json({
        error: 'Trip not found',
        code: 'TRIP_NOT_FOUND'
      });
    }

    // Verify place exists
    const place = await models.Place.findOne({
      where: {
        $or: [
          { id: placeId },
          { google_place_id: placeId }
        ]
      }
    });

    if (!place) {
      return res.status(404).json({
        error: 'Place not found',
        code: 'PLACE_NOT_FOUND'
      });
    }

    // Add place to trip
    const tripPlace = await models.TripPlace.create({
      trip_id: tripId,
      place_id: place.id,
      visit_date: visitDate,
      notes: notes,
      status: 'planned'
    });

    logger.info(`Added place ${place.name} to trip ${trip.title}`);

    res.json({
      success: true,
      tripPlace: tripPlace,
      message: `${place.name} added to ${trip.title}`
    });

  } catch (error) {
    logger.error('Add to trip error:', error);
    res.status(500).json({
      error: 'Failed to add place to trip',
      code: 'ADD_TO_TRIP_FAILED',
      message: error.message
    });
  }
});

/**
 * Get place photos from Google Places API
 */
router.get('/:placeId/photos', async (req, res) => {
  try {
    const { placeId } = req.params;
    const { maxWidth = 400, maxHeight = 400 } = req.query;

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        error: 'Google Places API key not configured',
        code: 'API_KEY_MISSING'
      });
    }

    // Get place photos from Google Places API
    const response = await axios.get(
      `${GOOGLE_PLACES_BASE_URL}/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'photos'
        }
      }
    );

    const photos = response.data.photos || [];
    const photoUrls = photos.map(photo => 
      `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${GOOGLE_PLACES_API_KEY}`
    );

    res.json({
      photos: photoUrls,
      count: photoUrls.length
    });

  } catch (error) {
    logger.error('Get photos error:', error);
    res.status(500).json({
      error: 'Failed to get place photos',
      code: 'PHOTOS_FAILED',
      message: error.message
    });
  }
});

module.exports = router;
