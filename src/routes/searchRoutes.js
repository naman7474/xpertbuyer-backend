const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Main search endpoint
router.post('/', searchController.search);

module.exports = router; 