const rateLimit = require('express-rate-limit');

// Memory store for rate limiting (fallback when Redis is unavailable)
const memoryStore = new Map();

// General API rate limiter (using memory store for now)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.round(15 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: Math.round(15 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// AI service rate limiter (more restrictive due to cost)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 AI requests per hour
  message: {
    error: 'AI service rate limit exceeded. Please try again later.',
    retryAfter: Math.round(60 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

// User-specific rate limiter (by user ID)
const createUserLimiter = (windowMs, max, prefix = 'user') => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      return req.user ? req.user.id : req.ip;
    },
    message: {
      error: 'Rate limit exceeded for this user.',
      retryAfter: Math.round(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Premium user rate limiter (higher limits)
const premiumUserLimiter = createUserLimiter(
  15 * 60 * 1000, // 15 minutes
  500, // 500 requests per 15 minutes
  'premium'
);

// Regular user rate limiter
const regularUserLimiter = createUserLimiter(
  15 * 60 * 1000, // 15 minutes
  200, // 200 requests per 15 minutes
  'regular'
);

// Dynamic rate limiter based on user tier
const dynamicUserLimiter = (req, res, next) => {
  if (req.user && req.user.subscriptionTier === 'premium') {
    return premiumUserLimiter(req, res, next);
  }
  return regularUserLimiter(req, res, next);
};

module.exports = {
  apiLimiter,
  authLimiter,
  aiLimiter,
  dynamicUserLimiter,
  premiumUserLimiter,
  regularUserLimiter
};
