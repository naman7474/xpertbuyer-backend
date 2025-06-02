const express = require('express');
const router = express.Router();

const aiAnalysisController = require('../controllers/aiAnalysisController');
const { authenticateToken } = require('../middleware/auth');

// All AI analysis routes require authentication
router.use(authenticateToken);

// Analysis triggers
router.post('/comprehensive', aiAnalysisController.triggerComprehensiveAnalysis);
router.post('/analyze/:category', aiAnalysisController.triggerCategoryAnalysis);

// Analysis results and history
router.get('/history', aiAnalysisController.getAnalysisHistory);
router.get('/dashboard', aiAnalysisController.getAnalysisDashboard);
router.get('/insights', aiAnalysisController.getInsightsSummary);
router.get('/result/:analysisId', aiAnalysisController.getAnalysisResult);

// Recommendations management
router.get('/recommendations', aiAnalysisController.getActiveRecommendations);
router.patch('/recommendations/:recommendationId/complete', aiAnalysisController.markRecommendationCompleted);

module.exports = router; 