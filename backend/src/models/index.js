const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Define User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  oauth_provider: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  oauth_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  profile_image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  travel_dna_score: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  preferences: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  push_token: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true
});

// Define Place model
const Place = sequelize.define('Place', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  subcategory: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  location: {
    type: DataTypes.GEOGRAPHY('POINT', 4326),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true
  },
  price_level: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  opening_hours: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  contact_info: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  external_ids: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'places',
  underscored: true,
  timestamps: true
});

// Define Trip model
const Trip = sequelize.define('Trip', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  destination_city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  destination_country: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  trip_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'planning'
  },
  itinerary: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  preferences: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'trips',
  underscored: true,
  timestamps: true
});

// Define associations
User.hasMany(Trip, { foreignKey: 'user_id', as: 'trips' });
Trip.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Place,
  Trip
};
