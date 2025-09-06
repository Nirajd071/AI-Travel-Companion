const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { testConnection } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectMongoDB } = require('./config/mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3001', 'http://127.0.0.1:44637'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AI Travel Backend'
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/places', require('./routes/places'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/travel-dna', require('./routes/travel-dna'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/chat', require('./routes/chat'));

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err.message
    });
  }
  
  // Handle programming errors
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Initialize all database connections
    await testConnection();
    await connectRedis();
    await connectMongoDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🗄️ PostgreSQL: Connected`);
      console.log(`⚡ Redis: Connected`);
      console.log(`📊 MongoDB: Connected`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
