const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trip = sequelize.define('Trip', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [3, 100]
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  destinationCoordinates: {
    type: DataTypes.GEOMETRY('POINT')
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isAfterStartDate(value) {
        if (value <= this.startDate) {
          throw new Error('End date must be after start date');
        }
      }
    }
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  status: {
    type: DataTypes.ENUM('planning', 'confirmed', 'ongoing', 'completed', 'cancelled'),
    defaultValue: 'planning'
  },
  visibility: {
    type: DataTypes.ENUM('private', 'friends', 'public'),
    defaultValue: 'private'
  },
  travelers: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  itinerary: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  recommendations: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  bookings: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  photos: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  rating: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  review: {
    type: DataTypes.TEXT
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  shareCode: {
    type: DataTypes.STRING,
    unique: true
  }
}, {
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['startDate'] },
    { fields: ['destination'] },
    { fields: ['shareCode'] }
  ]
});

// Generate share code before creation
Trip.beforeCreate(async (trip) => {
  if (!trip.shareCode) {
    trip.shareCode = require('crypto').randomBytes(8).toString('hex');
  }
});

module.exports = Trip;
