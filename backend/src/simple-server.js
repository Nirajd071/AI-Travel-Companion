/**
 * Simple Backend Server without Database Issues
 * Minimal setup for immediate functionality
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3005;

// Simple in-memory storage for demo
const users = new Map();
const places = [
  {
    id: '1',
    name: 'Eiffel Tower',
    category: 'tourist_attraction',
    description: 'Iconic iron lattice tower in Paris',
    address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
    city: 'Paris',
    country: 'France',
    rating: 4.6,
    price_level: 2,
    latitude: 48.8584,
    longitude: 2.2945
  },
  {
    id: '2',
    name: 'Louvre Museum',
    category: 'museum',
    description: 'World\'s largest art museum',
    address: 'Rue de Rivoli, 75001 Paris, France',
    city: 'Paris',
    country: 'France',
    rating: 4.7,
    price_level: 3,
    latitude: 48.8606,
    longitude: 2.3376
  },
  {
    id: '3',
    name: 'Notre-Dame Cathedral',
    category: 'tourist_attraction',
    description: 'Medieval Catholic cathedral',
    address: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France',
    city: 'Paris',
    country: 'France',
    rating: 4.5,
    price_level: 1,
    latitude: 48.8530,
    longitude: 2.3499
  }
];

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'AI Travel Companion Backend API',
    version: '1.0.0',
    frontend_url: 'http://localhost:3000',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      places: '/api/places'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'in-memory',
      api: 'operational'
    },
    version: '1.0.0'
  });
});

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (users.has(email)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      id: Date.now().toString(),
      email,
      first_name: firstName,
      last_name: lastName,
      password_hash: hashedPassword,
      created_at: new Date().toISOString()
    };

    users.set(email, user);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      'fallback-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password!' });
    }

    const user = users.get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      'fallback-secret-key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Places routes
app.get('/api/places/search', (req, res) => {
  try {
    const { latitude, longitude, radius = 10, limit = 20, category } = req.query;
    
    let filteredPlaces = places;
    
    if (category) {
      filteredPlaces = places.filter(place => place.category === category);
    }
    
    // Simple distance calculation (not accurate but functional)
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      filteredPlaces = filteredPlaces.map(place => ({
        ...place,
        distance_km: Math.sqrt(
          Math.pow(place.latitude - lat, 2) + Math.pow(place.longitude - lng, 2)
        ) * 111 // Rough km conversion
      })).filter(place => place.distance_km <= parseFloat(radius));
    }
    
    const limitedPlaces = filteredPlaces.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      places: limitedPlaces,
      count: limitedPlaces.length,
      total: filteredPlaces.length
    });
  } catch (error) {
    console.error('Places search error:', error);
    res.status(500).json({ error: 'Places search failed' });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(error.status || 500).json({
    error: 'Internal server error',
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple Backend Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🗺️  Places API: http://localhost:${PORT}/api/places`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`🌐 Frontend: http://localhost:3000`);
});

module.exports = app;
