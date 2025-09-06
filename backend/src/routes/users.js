const express = require('express');
const { User } = require('../models');
const { getMongoDb } = require('../config/mongodb');
const { protect } = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

// GET /api/users/profile - Get current user profile
router.get('/profile', protect, catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] }
  });

  if (!user) {
    return res.status(404).json({ 
      success: false,
      error: 'User not found' 
    });
  }

  res.json({
    success: true,
    data: user
  });
}));

// PUT /api/users/profile - Update user profile
router.put('/profile', protect, catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name, preferences, travel_dna_score } = req.body;
  
  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await user.update({
    first_name,
    last_name,
    preferences,
    travel_dna_score
  });

  // Log user activity to MongoDB
  try {
    const db = await getMongoDb();
    await db.collection('user_events').insertOne({
      user_id: userId.toString(),
      event_type: 'profile_update',
      timestamp: new Date(),
      metadata: { updated_fields: Object.keys(req.body) }
    });
  } catch (analyticsError) {
    console.error('Analytics logging error:', analyticsError);
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      preferences: user.preferences,
      travel_dna_score: user.travel_dna_score
    }
  });
}));

// GET /api/users/travel-stats - Get user travel statistics
router.get('/travel-stats', protect, catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  // Simple stats without caching for now
  const stats = {
    total_trips: 0,
    countries_visited: 0,
    total_budget: 0,
    upcoming_trips: 0
  };

  res.json({
    success: true,
    data: stats
  });
}));

// POST /api/users/push-token - Update user push notification token
router.post('/push-token', protect, catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { token, device_type } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Push token is required' });
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update user's push token
  await user.update({
    push_token: token,
    device_type: device_type || 'unknown'
  });

  // Log push token update to MongoDB
  try {
    const db = await getMongoDb();
    await db.collection('user_events').insertOne({
      user_id: userId.toString(),
      event_type: 'push_token_update',
      timestamp: new Date(),
      metadata: { device_type }
    });
  } catch (analyticsError) {
    console.error('Analytics logging error:', analyticsError);
  }

  res.json({
    success: true,
    message: 'Push token updated successfully'
  });
}));

module.exports = router;
