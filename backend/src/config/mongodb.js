const { MongoClient } = require('mongodb');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let mongoClient = null;
let analyticsDb = null;

const connectMongoDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://admin:admin_pass@localhost:27017/ai_travel_analytics?authSource=admin';
    
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    
    analyticsDb = mongoClient.db('ai_travel_analytics');
    
    // Test connection
    await analyticsDb.admin().ping();
    logger.info('MongoDB Analytics connection established successfully');
    
    return analyticsDb;
  } catch (error) {
    logger.error('Unable to connect to MongoDB:', error);
    throw error;
  }
};

const getAnalyticsDb = () => {
  if (!analyticsDb) {
    throw new Error('MongoDB not connected. Call connectMongoDB() first.');
  }
  return analyticsDb;
};

const closeMongoDB = async () => {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    analyticsDb = null;
    logger.info('MongoDB connection closed');
  }
};

module.exports = {
  connectMongoDB,
  getAnalyticsDb,
  closeMongoDB,
  logger
};
