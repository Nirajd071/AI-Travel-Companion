const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserLocation = sequelize.define('UserLocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  location: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    validate: {
      min: -90,
      max: 90
    }
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    validate: {
      min: -180,
      max: 180
    }
  },
  accuracy: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    comment: 'Location accuracy in meters'
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true
  },
  locationType: {
    type: DataTypes.ENUM('current', 'home', 'work', 'favorite', 'visited'),
    defaultValue: 'current',
    field: 'location_type'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  recordedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'recorded_at'
  }
}, {
  tableName: 'user_locations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['location'],
      using: 'GIST'
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['location_type']
    },
    {
      fields: ['recorded_at']
    },
    {
      fields: ['is_active']
    }
  ]
});

// Instance methods
UserLocation.prototype.getDistanceTo = function(lat, lng) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat - this.latitude) * Math.PI / 180;
  const dLng = (lng - this.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Static methods
UserLocation.getCurrentLocation = async function(userId) {
  return await UserLocation.findOne({
    where: {
      userId,
      locationType: 'current',
      isActive: true
    },
    order: [['recordedAt', 'DESC']]
  });
};

UserLocation.updateCurrentLocation = async function(userId, latitude, longitude, options = {}) {
  // Deactivate previous current location
  await UserLocation.update(
    { isActive: false },
    {
      where: {
        userId,
        locationType: 'current',
        isActive: true
      }
    }
  );

  // Create new current location
  return await UserLocation.create({
    userId,
    latitude,
    longitude,
    location: sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', longitude, latitude), 4326),
    locationType: 'current',
    accuracy: options.accuracy,
    address: options.address,
    city: options.city,
    country: options.country,
    isActive: true
  });
};

UserLocation.getLocationHistory = async function(userId, limit = 50) {
  return await UserLocation.findAll({
    where: {
      userId,
      isActive: true
    },
    order: [['recordedAt', 'DESC']],
    limit
  });
};

module.exports = UserLocation;
