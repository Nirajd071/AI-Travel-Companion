/**
 * Production Backend Server with Real Database Integration
 * PostgreSQL + PostGIS + Redis + Real API integrations
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { initializeDatabase, logger } = require('./config/production-database');

// Import production routes
const productionPlacesRouter = require('./routes/production-places');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://maps.googleapis.com", "https://places.googleapis.com"]
    }
  }
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration for production
app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3006',
    'https://your-production-domain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Key'
  ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { sequelize, redis } = require('./config/production-database');
    
    // Check database connection
    await sequelize.authenticate();
    
    // Check Redis connection
    await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        api: 'operational'
      },
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Routes
app.use('/api/places', productionPlacesRouter);
app.use('/api/auth', authRouter);

// Root route - redirect to frontend
app.get('/', (req, res) => {
  res.json({
    message: 'AI Travel Companion Backend API',
    version: '1.0.0',
    frontend_url: 'http://localhost:3000',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      places: '/api/places',
      ai_service: 'http://localhost:8000'
    },
    timestamp: new Date().toISOString()
  });
});

// Trip routes (placeholder for future implementation)
app.use('/api/trips', (req, res) => {
  res.json({ message: 'Trip endpoints coming soon' });
});

// Chat routes (placeholder - AI service handles this)
app.use('/api/chat', (req, res) => {
  res.json({ 
    message: 'Chat handled by AI service at http://localhost:8000',
    redirect: 'http://localhost:8000/chat'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
async function startServer() {
  try {
    logger.info('Initializing production database...');
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Production Backend Server running on http://0.0.0.0:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🗺️  Places API: http://localhost:${PORT}/api/places`);
      logger.info(`🤖 AI Service: http://localhost:8000`);
      logger.info(`🌐 Frontend: http://localhost:3002`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        const { gracefulShutdown: dbShutdown } = require('./config/production-database');
        dbShutdown().then(() => {
          logger.info('Database connections closed');
          process.exit(0);
        }).catch((error) => {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
