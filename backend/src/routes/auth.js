const express = require('express');
const { signup, login, logout, verifyEmail, refreshToken } = require('../controllers/authController');
const { forgotPassword, resetPassword, updatePassword, protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { performanceMonitor } = require('../middleware/monitoring');

const router = express.Router();

// Apply auth rate limiter to all routes
router.use(authLimiter);

// Public routes
router.post('/signup', (req, res, next) => {
  performanceMonitor.trackUserRegistration();
  next();
}, signup);

router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/refresh-token', refreshToken);

// Protected routes
router.patch('/update-password', protect, updatePassword);

module.exports = router;
