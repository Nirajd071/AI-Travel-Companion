const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Recommendation = sequelize.define('Recommendation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  tripId: {
    type: DataTypes.UUID,
    references: {
      model: 'Trips',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('destination', 'activity', 'restaurant', 'accommodation', 'transport'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  location: {
    type: DataTypes.STRING
  },
  coordinates: {
    type: DataTypes.GEOMETRY('POINT')
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1)
  },
  priceRange: {
    type: DataTypes.ENUM('$', '$$', '$$$', '$$$$')
  },
  category: {
    type: DataTypes.STRING
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  source: {
    type: DataTypes.ENUM('ai_generated', 'foursquare', 'google_places', 'manual'),
    allowNull: false
  },
  sourceId: {
    type: DataTypes.STRING
  },
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    validate: {
      min: 0,
      max: 1
    }
  },
  relevanceScore: {
    type: DataTypes.DECIMAL(3, 2)
  },
  userFeedback: {
    type: DataTypes.ENUM('liked', 'disliked', 'saved', 'ignored'),
    defaultValue: 'ignored'
  },
  isViewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isBookmarked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['tripId'] },
    { fields: ['type'] },
    { fields: ['userFeedback'] },
    { fields: ['relevanceScore'] }
  ]
});

module.exports = Recommendation;
