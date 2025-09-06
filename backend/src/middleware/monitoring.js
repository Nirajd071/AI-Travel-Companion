const prometheus = require('prom-client');
const { logger } = require('../config/database');

// Create a Registry to register the metrics
const register = new prometheus.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'ai-travel-backend'
});

// Enable the collection of default metrics
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const databaseConnections = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const aiServiceRequests = new prometheus.Counter({
  name: 'ai_service_requests_total',
  help: 'Total number of AI service requests',
  labelNames: ['service_type', 'status']
});

const userRegistrations = new prometheus.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations'
});

const tripCreations = new prometheus.Counter({
  name: 'trip_creations_total',
  help: 'Total number of trips created'
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(databaseConnections);
register.registerMetric(aiServiceRequests);
register.registerMetric(userRegistrations);
register.registerMetric(tripCreations);

// Middleware to collect HTTP metrics
const collectHttpMetrics = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};

// Health check metrics
const healthCheck = async () => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  try {
    // Check database connection
    const { sequelize } = require('../config/database');
    await sequelize.authenticate();
    healthStatus.database = 'connected';
    
    // Update database connections metric
    const pool = sequelize.connectionManager.pool;
    if (pool) {
      databaseConnections.set(pool.used);
    }
  } catch (error) {
    healthStatus.database = 'disconnected';
    healthStatus.status = 'unhealthy';
    logger.error('Database health check failed:', error);
  }

  try {
    // Check Redis connection
    const { redisClient } = require('./rateLimiter');
    await redisClient.ping();
    healthStatus.redis = 'connected';
  } catch (error) {
    healthStatus.redis = 'disconnected';
    logger.warn('Redis health check failed:', error);
  }

  return healthStatus;
};

// Performance monitoring
const performanceMonitor = {
  trackAIRequest: (serviceType, status = 'success') => {
    aiServiceRequests.labels(serviceType, status).inc();
  },
  
  trackUserRegistration: () => {
    userRegistrations.inc();
  },
  
  trackTripCreation: () => {
    tripCreations.inc();
  },
  
  updateActiveConnections: (count) => {
    activeConnections.set(count);
  }
};

// Error tracking
const errorTracker = {
  trackError: (error, context = {}) => {
    logger.error('Application error:', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  },
  
  trackApiError: (req, error) => {
    logger.error('API error:', {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user ? req.user.id : null,
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  register,
  collectHttpMetrics,
  healthCheck,
  performanceMonitor,
  errorTracker,
  metrics: {
    httpRequestDuration,
    httpRequestsTotal,
    activeConnections,
    databaseConnections,
    aiServiceRequests,
    userRegistrations,
    tripCreations
  }
};
