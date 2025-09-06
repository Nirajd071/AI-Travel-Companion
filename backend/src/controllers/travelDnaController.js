const TravelDNA = require('../models/TravelDNA');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { performanceMonitor } = require('../middleware/monitoring');

const createTravelDNA = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { quiz_responses } = req.body;

  if (!quiz_responses || Object.keys(quiz_responses).length === 0) {
    return next(new AppError('Quiz responses are required', 400));
  }

  // Check if user already has Travel DNA
  const existingDNA = await TravelDNA.findOne({ where: { userId } });
  if (existingDNA) {
    return next(new AppError('Travel DNA already exists. Use update endpoint instead.', 400));
  }

  // Create Travel DNA from quiz responses
  const travelDNA = await TravelDNA.createFromQuiz(userId, quiz_responses);

  performanceMonitor.trackAIRequest('travel_dna_creation', 'success');

  res.status(201).json({
    status: 'success',
    data: {
      travel_dna: {
        id: travelDNA.id,
        persona_labels: travelDNA.personaLabels,
        category_preferences: travelDNA.categoryPreferences,
        location_preferences: travelDNA.locationPreferences,
        budget_range: travelDNA.budgetRange,
        travel_style: travelDNA.travelStyle,
        preferred_distance_km: travelDNA.preferredDistanceKm,
        transport_modes: travelDNA.transportModes,
        confidence_score: travelDNA.confidenceScore,
        created_at: travelDNA.createdAt
      }
    }
  });
});

const getTravelDNA = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  
  if (!travelDNA) {
    return next(new AppError('Travel DNA not found. Please complete the onboarding quiz first.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      travel_dna: {
        id: travelDNA.id,
        persona_labels: travelDNA.personaLabels,
        category_preferences: travelDNA.categoryPreferences,
        activity_preferences: travelDNA.activityPreferences,
        location_preferences: travelDNA.locationPreferences,
        dietary_restrictions: travelDNA.dietaryRestrictions,
        accessibility_needs: travelDNA.accessibilityNeeds,
        preferred_languages: travelDNA.preferredLanguages,
        budget_range: travelDNA.budgetRange,
        travel_style: travelDNA.travelStyle,
        preferred_distance_km: travelDNA.preferredDistanceKm,
        preferred_travel_time_min: travelDNA.preferredTravelTimeMin,
        transport_modes: travelDNA.transportModes,
        confidence_score: travelDNA.confidenceScore,
        last_updated: travelDNA.lastUpdated,
        created_at: travelDNA.createdAt
      }
    }
  });
});

const updateTravelDNA = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const updates = req.body;

  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  
  if (!travelDNA) {
    return next(new AppError('Travel DNA not found. Please create it first.', 404));
  }

  // If quiz responses provided, recompute DNA
  if (updates.quiz_responses) {
    const newDNA = await TravelDNA.processQuizResponses(updates.quiz_responses);
    
    await travelDNA.update({
      personaVector: newDNA.vector,
      personaLabels: newDNA.labels,
      categoryPreferences: newDNA.categories,
      activityPreferences: newDNA.activities,
      locationPreferences: newDNA.location,
      quizResponses: updates.quiz_responses,
      confidenceScore: newDNA.confidence,
      lastUpdated: new Date()
    });
  } else {
    // Direct field updates
    const allowedUpdates = [
      'locationPreferences', 'dietaryRestrictions', 'accessibilityNeeds',
      'preferredLanguages', 'budgetRange', 'travelStyle', 
      'preferredDistanceKm', 'preferredTravelTimeMin', 'transportModes'
    ];

    const updateData = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    updateData.lastUpdated = new Date();
    await travelDNA.update(updateData);
  }

  res.status(200).json({
    status: 'success',
    data: {
      travel_dna: {
        id: travelDNA.id,
        persona_labels: travelDNA.personaLabels,
        category_preferences: travelDNA.categoryPreferences,
        location_preferences: travelDNA.locationPreferences,
        budget_range: travelDNA.budgetRange,
        travel_style: travelDNA.travelStyle,
        confidence_score: travelDNA.confidenceScore,
        last_updated: travelDNA.lastUpdated
      }
    }
  });
});

const getQuizQuestions = catchAsync(async (req, res, next) => {
  const quizQuestions = [
    {
      id: 'food_importance',
      type: 'scale',
      question: 'How important is food and dining when you travel?',
      description: 'Rate from 1 (not important) to 5 (extremely important)',
      scale: { min: 1, max: 5 },
      category: 'preferences'
    },
    {
      id: 'adventure_level',
      type: 'scale',
      question: 'How adventurous are you when traveling?',
      description: 'Rate from 1 (prefer familiar) to 5 (love new experiences)',
      scale: { min: 1, max: 5 },
      category: 'personality'
    },
    {
      id: 'culture_interest',
      type: 'scale',
      question: 'How interested are you in cultural sites and museums?',
      description: 'Rate from 1 (not interested) to 5 (very interested)',
      scale: { min: 1, max: 5 },
      category: 'interests'
    },
    {
      id: 'nature_preference',
      type: 'scale',
      question: 'How much do you enjoy nature and outdoor activities?',
      description: 'Rate from 1 (prefer indoors) to 5 (love outdoors)',
      scale: { min: 1, max: 5 },
      category: 'interests'
    },
    {
      id: 'budget_range',
      type: 'select',
      question: 'What is your typical travel budget range?',
      options: [
        { value: 1, label: 'Budget ($-$$)', description: 'Looking for affordable options' },
        { value: 2, label: 'Mid-range ($$-$$$)', description: 'Comfortable spending' },
        { value: 3, label: 'Luxury ($$$-$$$$)', description: 'Premium experiences' },
        { value: 4, label: 'Mixed', description: 'Varies by occasion' }
      ],
      category: 'budget'
    },
    {
      id: 'social_preference',
      type: 'scale',
      question: 'Do you prefer social activities or solo exploration?',
      description: 'Rate from 1 (solo) to 5 (very social)',
      scale: { min: 1, max: 5 },
      category: 'social'
    },
    {
      id: 'travel_style',
      type: 'select',
      question: 'How do you usually travel?',
      options: [
        { value: 'solo', label: 'Solo Travel', description: 'I prefer traveling alone' },
        { value: 'couple', label: 'Couple', description: 'Usually with my partner' },
        { value: 'family', label: 'Family', description: 'With family members' },
        { value: 'group', label: 'Group', description: 'With friends or groups' },
        { value: 'business', label: 'Business', description: 'Mostly business travel' }
      ],
      category: 'travel_style'
    },
    {
      id: 'activity_level',
      type: 'select',
      question: 'What is your preferred activity level?',
      options: [
        { value: 'relaxed', label: 'Relaxed', description: 'Prefer leisurely pace' },
        { value: 'moderate', label: 'Moderate', description: 'Mix of active and relaxed' },
        { value: 'active', label: 'Active', description: 'Love staying busy and active' },
        { value: 'intense', label: 'Intense', description: 'Pack in as much as possible' }
      ],
      category: 'activity'
    },
    {
      id: 'preferred_time',
      type: 'multiple',
      question: 'What times of day do you prefer for activities?',
      options: [
        { value: 'early_morning', label: 'Early Morning (6-9 AM)' },
        { value: 'morning', label: 'Morning (9-12 PM)' },
        { value: 'afternoon', label: 'Afternoon (12-5 PM)' },
        { value: 'evening', label: 'Evening (5-8 PM)' },
        { value: 'night', label: 'Night (8+ PM)' }
      ],
      category: 'timing'
    },
    {
      id: 'transport_modes',
      type: 'multiple',
      question: 'How do you prefer to get around when exploring?',
      options: [
        { value: 'walking', label: 'Walking', description: 'I love exploring on foot' },
        { value: 'cycling', label: 'Cycling', description: 'Bike rentals and cycling' },
        { value: 'public_transport', label: 'Public Transport', description: 'Buses, trains, metro' },
        { value: 'rideshare', label: 'Rideshare/Taxi', description: 'Uber, Lyft, taxis' },
        { value: 'rental_car', label: 'Rental Car', description: 'Prefer driving myself' }
      ],
      category: 'transport'
    },
    {
      id: 'max_distance',
      type: 'scale',
      question: 'How far are you willing to travel for recommendations?',
      description: 'Rate from 1 (very close, <5km) to 5 (anywhere in city, 50-100km)',
      scale: { min: 1, max: 5 },
      category: 'location'
    },
    {
      id: 'dietary_restrictions',
      type: 'multiple',
      question: 'Do you have any dietary restrictions or preferences?',
      options: [
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'gluten_free', label: 'Gluten-Free' },
        { value: 'halal', label: 'Halal' },
        { value: 'kosher', label: 'Kosher' },
        { value: 'dairy_free', label: 'Dairy-Free' },
        { value: 'nut_allergy', label: 'Nut Allergy' },
        { value: 'none', label: 'No Restrictions' }
      ],
      category: 'dietary'
    }
  ];

  res.status(200).json({
    status: 'success',
    data: {
      quiz: {
        title: 'Travel DNA Builder',
        description: 'Help us understand your travel personality and preferences',
        estimated_time: '3-5 minutes',
        questions: quizQuestions
      }
    }
  });
});

const analyzeTravelPersona = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const travelDNA = await TravelDNA.findOne({ where: { userId } });
  
  if (!travelDNA) {
    return next(new AppError('Travel DNA not found. Please complete the quiz first.', 404));
  }

  // Generate detailed persona analysis
  const analysis = {
    primary_persona: getPrimaryPersona(travelDNA.personaLabels),
    personality_breakdown: travelDNA.personaLabels,
    travel_insights: generateTravelInsights(travelDNA),
    recommendations_preview: generateRecommendationPreview(travelDNA),
    compatibility_scores: {
      foodie_spots: travelDNA.getCategoryWeight('restaurant'),
      cultural_sites: travelDNA.getCategoryWeight('museum'),
      outdoor_activities: travelDNA.getCategoryWeight('park'),
      nightlife: travelDNA.getCategoryWeight('bar'),
      shopping: travelDNA.getCategoryWeight('shopping')
    }
  };

  res.status(200).json({
    status: 'success',
    data: {
      persona_analysis: analysis,
      confidence_score: travelDNA.confidenceScore,
      last_updated: travelDNA.lastUpdated
    }
  });
});

// Helper functions
const getPrimaryPersona = (labels) => {
  const sortedLabels = Object.entries(labels).sort(([,a], [,b]) => b - a);
  return {
    type: sortedLabels[0][0],
    score: sortedLabels[0][1],
    description: getPersonaDescription(sortedLabels[0][0])
  };
};

const getPersonaDescription = (persona) => {
  const descriptions = {
    foodie: 'You love exploring local cuisine and discovering great restaurants',
    adventurer: 'You seek thrilling experiences and love trying new activities',
    culture_lover: 'You appreciate art, history, and cultural experiences',
    nature_lover: 'You prefer outdoor activities and natural settings',
    urban_explorer: 'You enjoy city life, architecture, and urban experiences',
    budget_traveler: 'You focus on value and finding great deals',
    luxury_seeker: 'You prefer premium experiences and high-end venues',
    social_butterfly: 'You love meeting people and social activities',
    solo_wanderer: 'You enjoy peaceful, contemplative travel experiences'
  };
  return descriptions[persona] || 'Unique travel personality';
};

const generateTravelInsights = (dna) => {
  const insights = [];
  
  if (dna.getPersonaScore('foodie') > 0.7) {
    insights.push('You have a strong passion for culinary experiences');
  }
  
  if (dna.preferredDistanceKm > 30) {
    insights.push('You\'re willing to travel far for great experiences');
  }
  
  if (dna.transportModes.includes('walking')) {
    insights.push('You enjoy exploring destinations on foot');
  }
  
  return insights;
};

const generateRecommendationPreview = (dna) => {
  const categories = Object.entries(dna.categoryPreferences)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category, score]) => ({ category, score }));
    
  return {
    top_categories: categories,
    budget_preference: dna.budgetRange,
    travel_style: dna.travelStyle
  };
};

module.exports = {
  createTravelDNA,
  getTravelDNA,
  updateTravelDNA,
  getQuizQuestions,
  analyzeTravelPersona
};
