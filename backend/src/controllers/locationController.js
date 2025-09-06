const UserLocation = require('../models/UserLocation');
const TravelDNA = require('../models/TravelDNA');
const googlePlacesService = require('../services/googlePlacesService');
const foursquareService = require('../services/foursquareService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { performanceMonitor } = require('../middleware/monitoring');

const updateLocation = catchAsync(async (req, res, next) => {
  const { latitude, longitude, accuracy, address, city, country } = req.body;
  const userId = req.user.id;

  if (!latitude || !longitude) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  // Validate coordinates
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return next(new AppError('Invalid coordinates', 400));
  }

  // Update user's current location
  const location = await UserLocation.updateCurrentLocation(userId, latitude, longitude, {
    accuracy,
    address,
    city,
    country
  });

  // Sync nearby POIs from external APIs (async, don't wait)
  syncNearbyPOIs(latitude, longitude).catch(error => {
    console.error('Error syncing POIs:', error);
  });

  res.status(200).json({
    status: 'success',
    data: {
      location: {
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        address: location.address,
        city: location.city,
        country: location.country,
        recorded_at: location.recordedAt
      }
    }
  });
});

const getCurrentLocation = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const location = await UserLocation.getCurrentLocation(userId);
  
  if (!location) {
    return next(new AppError('No current location found. Please share your location first.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      location: {
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        address: location.address,
        city: location.city,
        country: location.country,
        recorded_at: location.recordedAt
      }
    }
  });
});

const getLocationHistory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 20, type } = req.query;

  const whereClause = { userId, isActive: true };
  if (type) whereClause.locationType = type;

  const locations = await UserLocation.findAll({
    where: whereClause,
    order: [['recordedAt', 'DESC']],
    limit: parseInt(limit)
  });

  res.status(200).json({
    status: 'success',
    results: locations.length,
    data: {
      locations: locations.map(loc => ({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        address: loc.address,
        city: loc.city,
        country: loc.country,
        type: loc.locationType,
        recorded_at: loc.recordedAt
      }))
    }
  });
});

const addFavoriteLocation = catchAsync(async (req, res, next) => {
  const { latitude, longitude, name, address, city, country } = req.body;
  const userId = req.user.id;

  if (!latitude || !longitude || !name) {
    return next(new AppError('Latitude, longitude, and name are required', 400));
  }

  const location = await UserLocation.create({
    userId,
    latitude,
    longitude,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude]
    },
    address: name + (address ? `, ${address}` : ''),
    city,
    country,
    locationType: 'favorite',
    isActive: true
  });

  res.status(201).json({
    status: 'success',
    data: {
      location: {
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        name,
        address: location.address,
        city: location.city,
        country: location.country,
        type: location.locationType,
        recorded_at: location.recordedAt
      }
    }
  });
});

const syncPOIsAroundLocation = catchAsync(async (req, res, next) => {
  const { latitude, longitude, radius = 5000, source = 'both' } = req.body;
  const userId = req.user.id;

  if (!latitude || !longitude) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  let syncedPOIs = [];

  try {
    if (source === 'google' || source === 'both') {
      const googlePOIs = await googlePlacesService.syncNearbyPOIs(
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(radius)
      );
      syncedPOIs = syncedPOIs.concat(googlePOIs);
    }

    if (source === 'foursquare' || source === 'both') {
      const foursquarePOIs = await foursquareService.syncNearbyPOIs(
        parseFloat(latitude),
        parseFloat(longitude),
        parseInt(radius)
      );
      syncedPOIs = syncedPOIs.concat(foursquarePOIs);
    }

    performanceMonitor.trackAIRequest('poi_sync', 'success');

    res.status(200).json({
      status: 'success',
      message: `Synced ${syncedPOIs.length} POIs from ${source}`,
      data: {
        synced_count: syncedPOIs.length,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        radius_meters: parseInt(radius),
        source
      }
    });
  } catch (error) {
    performanceMonitor.trackAIRequest('poi_sync', 'error');
    return next(new AppError('Failed to sync POIs: ' + error.message, 500));
  }
});

const getGeofenceRecommendations = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { latitude, longitude, radius = 500 } = req.query;

  if (!latitude || !longitude) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  // Get user's Travel DNA for personalization
  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  
  // Find POIs within geofence radius
  const POI = require('../models/POI');
  const nearbyPOIs = await POI.findNearby(
    parseFloat(latitude),
    parseFloat(longitude),
    parseFloat(radius) / 1000, // Convert meters to km
    { limit: 10 }
  );

  // Score POIs based on Travel DNA if available
  const recommendations = nearbyPOIs.map(poi => {
    let score = 0.5;
    let reason = 'Nearby location';

    if (travelDNA) {
      const compatibility = travelDNA.isCompatibleWith(poi);
      score = compatibility.score;
      reason = `Matches your ${poi.category} preferences`;
    }

    return {
      poi_id: poi.id,
      name: poi.name,
      category: poi.category,
      distance_meters: poi.dataValues.distance_meters,
      rating: poi.rating,
      score,
      reason,
      coordinates: {
        latitude: poi.latitude,
        longitude: poi.longitude
      }
    };
  });

  // Sort by score and distance
  recommendations.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.1) {
      return a.distance_meters - b.distance_meters;
    }
    return b.score - a.score;
  });

  res.status(200).json({
    status: 'success',
    results: recommendations.length,
    data: {
      geofence: {
        center: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        radius_meters: parseInt(radius)
      },
      recommendations: recommendations.slice(0, 5) // Top 5 for geofence
    }
  });
});

// Helper function to sync POIs asynchronously
async function syncNearbyPOIs(latitude, longitude, radius = 5000) {
  try {
    // Sync from both Google Places and Foursquare
    const [googlePOIs, foursquarePOIs] = await Promise.allSettled([
      googlePlacesService.syncNearbyPOIs(latitude, longitude, radius),
      foursquareService.syncNearbyPOIs(latitude, longitude, radius)
    ]);

    let totalSynced = 0;
    if (googlePOIs.status === 'fulfilled') totalSynced += googlePOIs.value.length;
    if (foursquarePOIs.status === 'fulfilled') totalSynced += foursquarePOIs.value.length;

    console.log(`Background sync completed: ${totalSynced} POIs synced`);
  } catch (error) {
    console.error('Background POI sync error:', error);
  }
}

module.exports = {
  updateLocation,
  getCurrentLocation,
  getLocationHistory,
  addFavoriteLocation,
  syncPOIsAroundLocation,
  getGeofenceRecommendations
};
