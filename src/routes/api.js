const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController');
const { validateSearch, validateProductDetails, validateCompareProducts } = require('../middleware/validation');

// Health check
router.get('/health', searchController.healthCheck);

// Search products
router.post('/search', validateSearch, searchController.search);

// Get product details
router.get('/products/:productId', validateProductDetails, searchController.getProductDetails);

// Compare products
router.post('/compare', validateCompareProducts, searchController.compareProducts);

module.exports = router;