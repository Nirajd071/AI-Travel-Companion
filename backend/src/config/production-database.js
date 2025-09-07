/**
 * Production Database Configuration with PostgreSQL + PostGIS
 * Real database setup with geospatial capabilities - NO MOCK DATA
 */

const { Sequelize, DataTypes } = require('sequelize');
const winston = require('winston');
const Redis = require('ioredis');

// Enhanced logging configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/database.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// PostgreSQL + PostGIS Configuration
const sequelize = new Sequelize(
  process.env.DATABASE_URL || `postgres://${process.env.DB_USER || 'travel_user'}:${process.env.DB_PASS || 'travel_pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ai_travel_production'}`,
  {
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    logging: (msg) => logger.debug(msg),
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 25,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: 60000,
      idle: 10000,
      evict: 1000
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ESOCKETTIMEDOUT/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 5
    },
    define: {
      underscored: true,
      freezeTableName: false,
      charset: 'utf8',
      timestamps: true,
      paranoid: true // Soft deletes
    },
    benchmark: true,
    logQueryParameters: process.env.NODE_ENV !== 'production'
  }
);

// Redis Configuration for Caching and Real-time Features
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000
});

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('ready', () => {
  logger.info('Redis ready for operations');
});

// Database Models with PostGIS Support
const defineModels = () => {
  // Users Model
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    profile_picture: DataTypes.TEXT,
    travel_dna_type: DataTypes.STRING,
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    last_login: DataTypes.DATE,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    indexes: [
      { fields: ['email'] },
      { fields: ['travel_dna_type'] },
      { fields: ['is_active'] }
    ]
  });

  // Places Model with PostGIS
  const Place = sequelize.define('Place', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    google_place_id: {
      type: DataTypes.STRING,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    category: DataTypes.STRING,
    subcategory: DataTypes.STRING,
    location: {
      type: DataTypes.GEOMETRY('POINT', 4326), // PostGIS Point with WGS84
      allowNull: false
    },
    address: DataTypes.TEXT,
    city: DataTypes.STRING,
    country: DataTypes.STRING,
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      validate: {
        min: 0,
        max: 5
      }
    },
    price_level: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 4
      }
    },
    photos: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: []
    },
    opening_hours: DataTypes.JSONB,
    contact_info: DataTypes.JSONB,
    amenities: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    indexes: [
      { fields: ['google_place_id'] },
      { fields: ['category'] },
      { fields: ['city', 'country'] },
      { fields: ['rating'] },
      {
        name: 'places_location_gist',
        fields: ['location'],
        using: 'gist'
      }
    ]
  });

  // Trips Model
  const Trip = sequelize.define('Trip', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
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
    description: DataTypes.TEXT,
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
    budget: DataTypes.DECIMAL(10, 2),
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD'
    },
    status: {
      type: DataTypes.ENUM('planning', 'confirmed', 'ongoing', 'completed', 'cancelled'),
      defaultValue: 'planning'
    },
    itinerary: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    travelers_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    trip_type: DataTypes.STRING,
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['start_date', 'end_date'] }
    ]
  });

  // Trip Places Junction Table
  const TripPlace = sequelize.define('TripPlace', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    trip_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Trip,
        key: 'id'
      }
    },
    place_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Place,
        key: 'id'
      }
    },
    visit_date: DataTypes.DATE,
    visit_order: DataTypes.INTEGER,
    duration_minutes: DataTypes.INTEGER,
    notes: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM('planned', 'visited', 'skipped'),
      defaultValue: 'planned'
    }
  });

  // Chat Conversations Model
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      }
    },
    title: DataTypes.STRING,
    context: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    last_message_at: DataTypes.DATE
  });

  // Chat Messages Model
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Conversation,
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  });

  // Define Associations
  User.hasMany(Trip, { foreignKey: 'user_id', as: 'trips' });
  Trip.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Trip.belongsToMany(Place, { through: TripPlace, foreignKey: 'trip_id', as: 'places' });
  Place.belongsToMany(Trip, { through: TripPlace, foreignKey: 'place_id', as: 'trips' });

  User.hasMany(Conversation, { foreignKey: 'user_id', as: 'conversations' });
  Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
  Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

  return {
    User,
    Place,
    Trip,
    TripPlace,
    Conversation,
    Message
  };
};

// Database Connection and Initialization
const initializeDatabase = async () => {
  try {
    // Test PostgreSQL connection
    await sequelize.authenticate();
    logger.info('PostgreSQL connection established successfully');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection established successfully');

    // Enable PostGIS extension (ignore if already exists)
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      logger.info('PostGIS extension enabled');
    } catch (error) {
      if (error.original?.code === '23505') {
        logger.info('PostGIS extension already exists');
      } else {
        throw error;
      }
    }

    // Define models
    const models = defineModels();

    // Sync database - create tables if they don't exist
    await sequelize.sync({ force: false });
    logger.info('Database synchronized successfully');

    return { sequelize, redis, models, logger };

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Geospatial Query Helpers
const geoQueries = {
  // Find places within radius (in meters)
  findPlacesWithinRadius: async (lat, lng, radiusMeters, limit = 50) => {
    const models = defineModels();
    return await models.Place.findAll({
      where: sequelize.where(
        sequelize.fn(
          'ST_DWithin',
          sequelize.col('location'),
          sequelize.fn('ST_GeogFromText', `POINT(${lng} ${lat})`),
          radiusMeters
        ),
        true
      ),
      attributes: {
        include: [
          [
            sequelize.fn(
              'ST_Distance',
              sequelize.col('location'),
              sequelize.fn('ST_GeogFromText', `POINT(${lng} ${lat})`)
            ),
            'distance'
          ]
        ]
      },
      order: [[sequelize.literal('distance'), 'ASC']],
      limit
    });
  },

  // Calculate distance between two points
  calculateDistance: async (lat1, lng1, lat2, lng2) => {
    const result = await sequelize.query(`
      SELECT ST_Distance(
        ST_GeogFromText('POINT(${lng1} ${lat1})'),
        ST_GeogFromText('POINT(${lng2} ${lat2})')
      ) as distance
    `, { type: sequelize.QueryTypes.SELECT });
    
    return result[0]?.distance || 0;
  }
};

// Cache Helper Functions
const cache = {
  get: async (key) => {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  set: async (key, value, ttlSeconds = 3600) => {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  },

  del: async (key) => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  },

  // Cache places search results
  cachePlacesSearch: async (searchKey, places, ttl = 1800) => {
    return await cache.set(`places:${searchKey}`, places, ttl);
  },

  getCachedPlacesSearch: async (searchKey) => {
    return await cache.get(`places:${searchKey}`);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down database connections...');
  
  try {
    await sequelize.close();
    logger.info('PostgreSQL connection closed');
    
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
  sequelize,
  redis,
  initializeDatabase,
  defineModels,
  geoQueries,
  cache,
  logger,
  gracefulShutdown
};
