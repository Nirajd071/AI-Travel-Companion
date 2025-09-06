const POI = require('../models/POI');
const TravelDNA = require('../models/TravelDNA');
const UserLocation = require('../models/UserLocation');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { performanceMonitor } = require('../middleware/monitoring');

const getNearbyRecommendations = catchAsync(async (req, res, next) => {
  const { latitude, longitude, radius = 50, category, min_rating, price_level } = req.query;
  const userId = req.user.id;

  if (!latitude || !longitude) {
    return next(new AppError('Latitude and longitude are required', 400));
  }

  // Get user's Travel DNA
  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  if (!travelDNA) {
    return next(new AppError('Please complete your travel preferences first', 400));
  }

  // Find POIs within city radius (50-100km)
  const pois = await POI.findNearby(
    parseFloat(latitude),
    parseFloat(longitude),
    parseFloat(radius), // City-wide radius
    {
      category,
      minRating: min_rating,
      priceLevel: price_level,
      limit: 100
    }
  );

  // Score and rank POIs based on Travel DNA
  const scoredPois = pois.map(poi => {
    const compatibility = travelDNA.isCompatibleWith(poi);
    const distanceKm = poi.dataValues.distance_meters / 1000;
    const travelTimeMin = calculateTravelTime(distanceKm, transport_mode);
    
    return {
      ...poi.toJSON(),
      distance_km: distanceKm,
      travel_time_min: travelTimeMin,
      compatibility_score: compatibility.score,
      recommendation_reason: generateRecommendationReason(poi, travelDNA, compatibility),
      is_open_now: poi.isOpenNow()
    };
  });

  // Sort by compatibility score and distance
  scoredPois.sort((a, b) => {
    if (Math.abs(a.compatibility_score - b.compatibility_score) < 0.1) {
      return a.distance_km - b.distance_km;
    }
    return b.compatibility_score - a.compatibility_score;
  });

  // Update user location if provided
  if (req.body.update_location !== false) {
    await UserLocation.updateCurrentLocation(userId, parseFloat(latitude), parseFloat(longitude));
  }

  performanceMonitor.trackAIRequest('location_recommendations', 'success');

  res.status(200).json({
    status: 'success',
    results: scoredPois.length,
    data: {
      recommendations: scoredPois.slice(0, 20), // Return top 20
      user_location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      },
      search_params: {
        radius_km: parseFloat(radius),
        transport_mode,
        max_travel_time_min: parseInt(max_travel_time)
      }
    }
  });
});

const getPersonalizedRecommendations = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { mood, time_of_day, weather, group_size } = req.query;

  // Get user's current location
  const currentLocation = await UserLocation.getCurrentLocation(userId);
  if (!currentLocation) {
    return next(new AppError('Current location not available. Please share your location first.', 400));
  }

  // Get Travel DNA
  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  if (!travelDNA) {
    return next(new AppError('Please complete your travel preferences first', 400));
  }

  // Find POIs within preferred travel time
  const pois = await POI.findByTravelTime(
    currentLocation.latitude,
    currentLocation.longitude,
    travelDNA.preferredTravelTimeMin,
    travelDNA.getPreferredTransportMode()
  );

  // Apply contextual filtering
  const contextualPois = pois.filter(poi => {
    // Filter by time of day
    if (time_of_day && poi.openingHours) {
      const isOpen = poi.isOpenNow();
      if (isOpen === false) return false;
    }

    // Filter by mood
    if (mood) {
      const moodCategories = getMoodCategories(mood);
      if (!moodCategories.includes(poi.category)) return false;
    }

    return true;
  });

  // Score and personalize
  const personalizedPois = contextualPois.map(poi => {
    const compatibility = travelDNA.isCompatibleWith(poi);
    const contextScore = calculateContextScore(poi, { mood, time_of_day, weather, group_size });
    const finalScore = compatibility.score * 0.7 + contextScore * 0.3;

    return {
      ...poi.toJSON(),
      distance_km: poi.dataValues.distance_meters / 1000,
      travel_time_min: calculateTravelTime(poi.dataValues.distance_meters / 1000, travelDNA.getPreferredTransportMode()),
      personalization_score: finalScore,
      context_score: contextScore,
      recommendation_reason: generateContextualReason(poi, travelDNA, { mood, time_of_day, weather }),
      is_open_now: poi.isOpenNow()
    };
  });

  // Sort by personalization score
  personalizedPois.sort((a, b) => b.personalization_score - a.personalization_score);

  performanceMonitor.trackAIRequest('personalized_recommendations', 'success');

  res.status(200).json({
    status: 'success',
    results: personalizedPois.length,
    data: {
      recommendations: personalizedPois.slice(0, 15),
      context: {
        mood,
        time_of_day,
        weather,
        group_size,
        user_location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        }
      }
    }
  });
});

const getHiddenGems = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { latitude, longitude } = req.query;

  let userLat, userLng;
  
  if (latitude && longitude) {
    userLat = parseFloat(latitude);
    userLng = parseFloat(longitude);
  } else {
    const currentLocation = await UserLocation.getCurrentLocation(userId);
    if (!currentLocation) {
      return next(new AppError('Location required for hidden gems discovery', 400));
    }
    userLat = currentLocation.latitude;
    userLng = currentLocation.longitude;
  }

  // Get Travel DNA
  const travelDNA = await TravelDNA.findOne({ where: { userId } });

  // Find lesser-known POIs (low review count but good rating)
  const hiddenGems = await POI.findNearby(userLat, userLng, 10, {
    limit: 100
  });

  // Filter for hidden gems criteria
  const gems = hiddenGems.filter(poi => {
    return (
      poi.reviewCount < 50 && // Less reviewed
      poi.rating >= 4.0 && // But highly rated
      poi.popularityScore < 0.7 // Not too popular
    );
  });

  // Score based on user preferences
  const scoredGems = gems.map(poi => {
    const compatibility = travelDNA ? travelDNA.isCompatibleWith(poi) : { score: 0.5 };
    const hiddenScore = calculateHiddenGemScore(poi);
    
    return {
      ...poi.toJSON(),
      distance_km: poi.dataValues.distance_meters / 1000,
      travel_time_min: calculateTravelTime(poi.dataValues.distance_meters / 1000, 'walking'),
      hidden_gem_score: hiddenScore,
      compatibility_score: compatibility.score,
      recommendation_reason: `Hidden gem with ${poi.rating}⭐ rating but only ${poi.reviewCount} reviews`,
      is_open_now: poi.isOpenNow()
    };
  });

  scoredGems.sort((a, b) => b.hidden_gem_score - a.hidden_gem_score);

  res.status(200).json({
    status: 'success',
    results: scoredGems.length,
    data: {
      hidden_gems: scoredGems.slice(0, 10),
      discovery_location: {
        latitude: userLat,
        longitude: userLng
      }
    }
  });
});

// Helper functions
const calculateTravelTime = (distanceKm, transportMode) => {
  const speeds = {
    walking: 5,
    cycling: 15,
    public_transport: 20,
    driving: 30
  };
  
  const speedKmh = speeds[transportMode] || 5;
  return Math.round((distanceKm / speedKmh) * 60);
};

const generateRecommendationReason = (poi, travelDNA, compatibility) => {
  const reasons = [];
  
  if (compatibility.categoryWeight > 0.7) {
    reasons.push(`Perfect match for your ${poi.category} preferences`);
  }
  
  if (poi.rating >= 4.5) {
    reasons.push(`Highly rated (${poi.rating}⭐)`);
  }
  
  if (compatibility.distanceOk) {
    reasons.push(`Within your preferred travel distance`);
  }
  
  if (compatibility.budgetMatch) {
    reasons.push(`Matches your budget preferences`);
  }
  
  return reasons.join(' • ') || 'Recommended based on your travel style';
};

const getMoodCategories = (mood) => {
  const moodMap = {
    relaxed: ['cafe', 'park', 'nature', 'cultural'],
    adventurous: ['outdoor', 'attraction', 'entertainment'],
    social: ['restaurant', 'bar', 'nightlife', 'entertainment'],
    cultural: ['museum', 'cultural', 'historical', 'religious'],
    romantic: ['restaurant', 'park', 'attraction', 'cultural'],
    energetic: ['outdoor', 'entertainment', 'shopping', 'nightlife']
  };
  
  return moodMap[mood] || Object.keys(moodMap).flatMap(m => moodMap[m]);
};

const calculateContextScore = (poi, context) => {
  let score = 0.5;
  
  // Time of day adjustments
  if (context.time_of_day === 'morning' && ['cafe', 'park'].includes(poi.category)) {
    score += 0.2;
  } else if (context.time_of_day === 'evening' && ['restaurant', 'bar', 'nightlife'].includes(poi.category)) {
    score += 0.2;
  }
  
  // Weather adjustments
  if (context.weather === 'sunny' && ['park', 'outdoor', 'nature'].includes(poi.category)) {
    score += 0.1;
  } else if (context.weather === 'rainy' && ['museum', 'shopping', 'cafe'].includes(poi.category)) {
    score += 0.1;
  }
  
  return Math.min(1, score);
};

const generateContextualReason = (poi, travelDNA, context) => {
  const reasons = [];
  
  if (context.mood) {
    reasons.push(`Great for a ${context.mood} mood`);
  }
  
  if (context.time_of_day) {
    reasons.push(`Perfect for ${context.time_of_day}`);
  }
  
  if (poi.rating >= 4.0) {
    reasons.push(`${poi.rating}⭐ rated`);
  }
  
  return reasons.join(' • ') || 'Personalized for you';
};

const calculateHiddenGemScore = (poi) => {
  const ratingScore = (poi.rating - 3) / 2; // Normalize 3-5 to 0-1
  const obscurityScore = Math.max(0, (100 - poi.reviewCount) / 100);
  const popularityScore = 1 - poi.popularityScore;
  
  return (ratingScore * 0.4 + obscurityScore * 0.3 + popularityScore * 0.3);
};

module.exports = {
  getNearbyRecommendations,
  getPersonalizedRecommendations,
  getHiddenGems
};
