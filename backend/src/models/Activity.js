const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tripId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Trips',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.ENUM('accommodation', 'restaurant', 'attraction', 'transport', 'activity', 'shopping', 'other'),
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  coordinates: {
    type: DataTypes.GEOMETRY('POINT')
  },
  address: {
    type: DataTypes.TEXT
  },
  scheduledDate: {
    type: DataTypes.DATE
  },
  startTime: {
    type: DataTypes.TIME
  },
  endTime: {
    type: DataTypes.TIME
  },
  duration: {
    type: DataTypes.INTEGER // in minutes
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2)
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  bookingStatus: {
    type: DataTypes.ENUM('not_booked', 'pending', 'confirmed', 'cancelled'),
    defaultValue: 'not_booked'
  },
  bookingReference: {
    type: DataTypes.STRING
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT
  },
  photos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    validate: {
      min: 0,
      max: 5
    }
  },
  reviews: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  externalIds: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['tripId'] },
    { fields: ['category'] },
    { fields: ['scheduledDate'] },
    { fields: ['bookingStatus'] }
  ]
});

module.exports = Activity;
