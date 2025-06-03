const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');
const videoController = require('../controllers/videoController');
const { validateSearch, validateProductDetails, validateCompareProducts, validateProductVideos, validateVideosSummary } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');

// Import route modules
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const activityRoutes = require('./activityRoutes');
const aiAnalysisRoutes = require('./aiAnalysisRoutes');

// Health check
router.get('/health', searchController.healthCheck);

// Authentication routes
router.use('/auth', authRoutes);

// Profile management routes
router.use('/profile', profileRoutes);

// Activity tracking routes
router.use('/activity', activityRoutes);

// AI analysis routes
router.use('/ai', aiAnalysisRoutes);

// Search products - with optional authentication for personalization
router.post('/search', optionalAuth, validateSearch, searchController.search);

// Get product details
router.get('/products/:productId', validateProductDetails, searchController.getProductDetails);

// Compare products
router.post('/compare', validateCompareProducts, searchController.compareProducts);

// Video content endpoints
// Get video content for a specific product
router.get('/products/:productId/videos', validateProductVideos, videoController.getProductVideos);

// Get summary of video content for multiple products
router.get('/videos/products-summary', validateVideosSummary, videoController.getVideosSummary);

module.exports = router;