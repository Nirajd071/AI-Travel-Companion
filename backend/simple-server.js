const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory user storage for persistence
const users = new Map();

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:44637'],
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
    service: 'AI Travel Backend (Simple Mode)'
  });
});

// Authentication endpoints with persistence
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }
  
  // Check if user already exists
  if (users.has(email)) {
    return res.status(400).json({ error: 'User already exists with this email' });
  }
  
  // Create new user
  const user = {
    id: users.size + 1,
    email: email,
    password: password, // In production, this should be hashed
    first_name: name.split(' ')[0] || 'User',
    last_name: name.split(' ')[1] || '',
    created_at: new Date().toISOString()
  };
  
  users.set(email, user);
  
  res.json({
    success: true,
    token: 'jwt-token-' + user.id + '-' + Date.now(),
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Check if user exists
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  // Check password
  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  
  res.json({
    success: true,
    token: 'jwt-token-' + user.id + '-' + Date.now(),
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  });
});

// Mock user profile endpoint
app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    }
  });
});

// Mock places endpoints
app.get('/api/places/nearby', (req, res) => {
  const { lat, lng, limit = 10 } = req.query;
  
  const mockPlaces = [
    {
      id: 1,
      name: 'Eiffel Tower',
      category: 'Landmark',
      description: 'Iconic iron lattice tower and symbol of Paris',
      address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris',
      rating: 4.6,
      price_level: 2,
      distance_km: 0.5,
      latitude: 48.8584,
      longitude: 2.2945
    },
    {
      id: 2,
      name: 'Louvre Museum',
      category: 'Museum',
      description: 'World\'s largest art museum and historic monument',
      address: 'Rue de Rivoli, 75001 Paris',
      rating: 4.7,
      price_level: 2,
      distance_km: 2.1,
      latitude: 48.8606,
      longitude: 2.3376
    },
    {
      id: 3,
      name: 'Le Comptoir du Relais',
      category: 'Restaurant',
      description: 'Traditional French bistro with authentic cuisine',
      address: '12 Rue de l\'Abbaye, 75006 Paris',
      rating: 4.4,
      price_level: 3,
      distance_km: 1.2,
      latitude: 48.8530,
      longitude: 2.3499
    }
  ];
  
  res.json({
    success: true,
    data: mockPlaces.slice(0, parseInt(limit))
  });
});

app.post('/api/places/search', (req, res) => {
  const { query, latitude, longitude, limit = 10 } = req.body;
  
  const mockSearchResults = [
    {
      id: 'place1',
      displayName: { text: 'Café de Flore' },
      name: 'Café de Flore',
      types: ['cafe', 'restaurant'],
      rating: 4.2,
      priceLevel: 2,
      formattedAddress: '172 Boulevard Saint-Germain, 75006 Paris, France'
    },
    {
      id: 'place2',
      displayName: { text: 'Notre-Dame Cathedral' },
      name: 'Notre-Dame Cathedral',
      types: ['church', 'tourist_attraction'],
      rating: 4.5,
      priceLevel: 1,
      formattedAddress: '6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris, France'
    },
    {
      id: 'place3',
      displayName: { text: 'Arc de Triomphe' },
      name: 'Arc de Triomphe',
      types: ['tourist_attraction', 'establishment'],
      rating: 4.5,
      priceLevel: 2,
      formattedAddress: 'Pl. Charles de Gaulle, 75008 Paris, France'
    }
  ];
  
  const filtered = query ? 
    mockSearchResults.filter(place => 
      place.name.toLowerCase().includes(query.toLowerCase()) ||
      place.types.some(type => type.toLowerCase().includes(query.toLowerCase()))
    ) : mockSearchResults;
  
  res.json({
    success: true,
    data: filtered.slice(0, parseInt(limit))
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Mode: Simple (No Database Dependencies)`);
  console.log(`✅ CORS enabled for frontend origins`);
});
