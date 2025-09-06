const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const POI = sequelize.define('POI', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM(
      'restaurant', 'cafe', 'bar', 'attraction', 'museum', 'park', 
      'shopping', 'hotel', 'transport', 'entertainment', 'nightlife',
      'outdoor', 'cultural', 'religious', 'historical', 'nature'
    ),
    allowNull: false
  },
  subcategory: {
    type: DataTypes.STRING,
    allowNull: true
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
  postalCode: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'postal_code'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    validate: {
      min: 0,
      max: 5
    }
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'review_count'
  },
  priceLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 4
    },
    field: 'price_level'
  },
  openingHours: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'opening_hours'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  features: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'external_id'
  },
  externalSource: {
    type: DataTypes.ENUM('google_places', 'foursquare', 'manual'),
    allowNull: false,
    defaultValue: 'manual',
    field: 'external_source'
  },
  popularityScore: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0.5,
    field: 'popularity_score'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_updated'
  }
}, {
  tableName: 'pois',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['location'],
      using: 'GIST'
    },
    {
      fields: ['category']
    },
    {
      fields: ['city']
    },
    {
      fields: ['rating']
    },
    {
      fields: ['external_source', 'external_id']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['popularity_score']
    }
  ]
});

// Instance methods
POI.prototype.getDistanceFrom = function(lat, lng) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat - this.latitude) * Math.PI / 180;
  const dLng = (lng - this.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

POI.prototype.isOpenNow = function() {
  if (!this.openingHours) return null;
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const todayHours = this.openingHours[dayOfWeek];
  if (!todayHours || todayHours.closed) return false;
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

// Static methods
POI.findNearby = async function(latitude, longitude, radiusKm = 5, options = {}) {
  const {
    category,
    minRating,
    priceLevel,
    limit = 20,
    offset = 0
  } = options;

  const whereClause = {
    isActive: true,
    location: sequelize.where(
      sequelize.fn(
        'ST_DWithin',
        sequelize.col('location'),
        sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', longitude, latitude), 4326),
        radiusKm * 1000 // Convert km to meters
      ),
      true
    )
  };

  if (category) whereClause.category = category;
  if (minRating) whereClause.rating = { [sequelize.Op.gte]: minRating };
  if (priceLevel) whereClause.priceLevel = priceLevel;

  const pois = await POI.findAll({
    where: whereClause,
    attributes: {
      include: [
        [
          sequelize.fn(
            'ST_Distance',
            sequelize.col('location'),
            sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', longitude, latitude), 4326)
          ),
          'distance_meters'
        ]
      ]
    },
    order: [
      [sequelize.literal('distance_meters'), 'ASC'],
      ['popularityScore', 'DESC'],
      ['rating', 'DESC']
    ],
    limit,
    offset
  });

  return pois;
};

POI.findByTravelTime = async function(latitude, longitude, maxTravelTimeMin = 10, transportMode = 'walking') {
  // Walking speed: ~5 km/h, Cycling: ~15 km/h, Driving: ~30 km/h in city
  const speedKmh = {
    walking: 5,
    cycling: 15,
    public_transport: 20,
    driving: 30
  };

  const maxDistanceKm = (speedKmh[transportMode] || 5) * (maxTravelTimeMin / 60);
  
  return await POI.findNearby(latitude, longitude, maxDistanceKm, {
    limit: 50
  });
};

module.exports = POI;
