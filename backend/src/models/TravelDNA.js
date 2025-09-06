const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TravelDNA = sequelize.define('TravelDNA', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  personaVector: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'persona_vector',
    comment: 'Normalized feature vector representing user travel preferences'
  },
  personaLabels: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'persona_labels',
    comment: 'Human-readable labels with scores (e.g., {"foodie": 0.8, "adventurer": 0.6})'
  },
  locationPreferences: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'location_preferences',
    comment: 'Preferred locations, distance tolerance, transport modes'
  },
  categoryPreferences: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'category_preferences',
    comment: 'POI category preferences with weights'
  },
  activityPreferences: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'activity_preferences',
    comment: 'Time preferences, group size, budget range'
  },
  dietaryRestrictions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'dietary_restrictions'
  },
  accessibilityNeeds: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'accessibility_needs'
  },
  preferredLanguages: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['en'],
    field: 'preferred_languages'
  },
  budgetRange: {
    type: DataTypes.ENUM('budget', 'mid-range', 'luxury', 'mixed'),
    defaultValue: 'mixed',
    field: 'budget_range'
  },
  travelStyle: {
    type: DataTypes.ENUM('solo', 'couple', 'family', 'group', 'business'),
    defaultValue: 'solo',
    field: 'travel_style'
  },
  preferredDistanceKm: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    field: 'preferred_distance_km',
    comment: 'Maximum distance in km for recommendations'
  },
  preferredTravelTimeMin: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    field: 'preferred_travel_time_min',
    comment: 'Maximum travel time in minutes'
  },
  transportModes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['walking', 'public_transport'],
    field: 'transport_modes',
    comment: 'Preferred transport: walking, cycling, public_transport, driving'
  },
  quizResponses: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'quiz_responses',
    comment: 'Original quiz responses for recomputation'
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0.5,
    field: 'confidence_score',
    comment: 'Confidence in DNA accuracy (0-1)'
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_updated'
  }
}, {
  tableName: 'travel_dna',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id'],
      unique: true
    },
    {
      fields: ['confidence_score']
    },
    {
      fields: ['budget_range']
    },
    {
      fields: ['travel_style']
    }
  ]
});

// Instance methods
TravelDNA.prototype.getPersonaScore = function(label) {
  return this.personaLabels[label] || 0;
};

TravelDNA.prototype.getCategoryWeight = function(category) {
  return this.categoryPreferences[category] || 0.5;
};

TravelDNA.prototype.getPreferredTransportMode = function() {
  return this.transportModes[0] || 'walking';
};

TravelDNA.prototype.isCompatibleWith = function(poi) {
  const categoryWeight = this.getCategoryWeight(poi.category);
  const budgetMatch = this.isBudgetCompatible(poi.priceLevel);
  const distanceOk = poi.distance_meters <= (this.preferredDistanceKm * 1000);
  
  return {
    score: categoryWeight * (budgetMatch ? 1 : 0.5) * (distanceOk ? 1 : 0.3),
    categoryWeight,
    budgetMatch,
    distanceOk
  };
};

TravelDNA.prototype.isBudgetCompatible = function(priceLevel) {
  if (!priceLevel) return true;
  
  const budgetMap = {
    'budget': [1, 2],
    'mid-range': [2, 3],
    'luxury': [3, 4],
    'mixed': [1, 2, 3, 4]
  };
  
  return budgetMap[this.budgetRange].includes(priceLevel);
};

// Static methods
TravelDNA.createFromQuiz = async function(userId, quizResponses) {
  const dna = await this.processQuizResponses(quizResponses);
  
  return await TravelDNA.create({
    userId,
    personaVector: dna.vector,
    personaLabels: dna.labels,
    categoryPreferences: dna.categories,
    activityPreferences: dna.activities,
    locationPreferences: dna.location,
    quizResponses,
    confidenceScore: dna.confidence
  });
};

TravelDNA.processQuizResponses = async function(responses) {
  // Process quiz responses into Travel DNA
  const categories = {
    restaurant: 0.5,
    cafe: 0.5,
    bar: 0.3,
    attraction: 0.7,
    museum: 0.4,
    park: 0.6,
    shopping: 0.4,
    entertainment: 0.5,
    nightlife: 0.3,
    outdoor: 0.6,
    cultural: 0.5,
    historical: 0.4,
    nature: 0.6
  };

  const labels = {
    foodie: 0.5,
    adventurer: 0.5,
    culture_lover: 0.5,
    nature_lover: 0.5,
    urban_explorer: 0.5,
    budget_traveler: 0.5,
    luxury_seeker: 0.3,
    social_butterfly: 0.5,
    solo_wanderer: 0.4
  };

  // Process responses to adjust weights
  Object.keys(responses).forEach(key => {
    const value = responses[key];
    
    switch(key) {
      case 'food_importance':
        categories.restaurant += value * 0.3;
        categories.cafe += value * 0.2;
        labels.foodie += value * 0.4;
        break;
      case 'adventure_level':
        categories.outdoor += value * 0.3;
        categories.attraction += value * 0.2;
        labels.adventurer += value * 0.5;
        break;
      case 'culture_interest':
        categories.museum += value * 0.4;
        categories.cultural += value * 0.3;
        categories.historical += value * 0.3;
        labels.culture_lover += value * 0.5;
        break;
      case 'nature_preference':
        categories.park += value * 0.4;
        categories.nature += value * 0.5;
        labels.nature_lover += value * 0.5;
        break;
      case 'budget_range':
        if (value <= 2) labels.budget_traveler += 0.4;
        if (value >= 4) labels.luxury_seeker += 0.4;
        break;
      case 'social_preference':
        if (value >= 4) labels.social_butterfly += 0.3;
        if (value <= 2) labels.solo_wanderer += 0.3;
        break;
    }
  });

  // Normalize values
  Object.keys(categories).forEach(key => {
    categories[key] = Math.min(1, Math.max(0, categories[key]));
  });
  
  Object.keys(labels).forEach(key => {
    labels[key] = Math.min(1, Math.max(0, labels[key]));
  });

  return {
    vector: Object.values(categories),
    labels,
    categories,
    activities: {
      preferred_time: responses.preferred_time || 'any',
      group_size: responses.group_size || 'solo',
      activity_level: responses.activity_level || 'moderate'
    },
    location: {
      max_distance_km: responses.max_distance || 5,
      max_travel_time_min: responses.max_travel_time || 10,
      transport_modes: responses.transport_modes || ['walking']
    },
    confidence: 0.7
  };
};

module.exports = TravelDNA;
