const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { aiRateLimiter } = require('../src/middleware/rateLimiter');
const {
  categorizeExpense,
  detectAnomaly,
  textToQuery,
  getAIHealth,
} = require('../controller/aiController');

// Health check endpoint (public)
router.get('/health', getAIHealth);

// Authenticated AI endpoints with rate limiting
router.post('/categorize', protect, aiRateLimiter, categorizeExpense);
router.post('/anomaly', protect, aiRateLimiter, detectAnomaly);
router.post('/query', protect, aiRateLimiter, textToQuery);

module.exports = router;
