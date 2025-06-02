const express = require('express');
const router = express.Router();

const activityController = require('../controllers/activityController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Activity tracking routes (can work with or without authentication)
router.post('/track', optionalAuth, activityController.trackActivity);
router.post('/track/product-view', optionalAuth, activityController.trackProductView);
router.post('/track/search', optionalAuth, activityController.trackSearch);
router.post('/track/filter', optionalAuth, activityController.trackFilterApplication);
router.post('/track/recommendation', optionalAuth, activityController.trackRecommendation);

// Authenticated activity tracking
router.post('/track/wishlist', authenticateToken, activityController.trackWishlist);

// User activity analytics (requires authentication)
router.get('/history', authenticateToken, activityController.getUserActivityHistory);
router.get('/analytics', authenticateToken, activityController.getUserActivityAnalytics);

module.exports = router; 