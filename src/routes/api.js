// src/routes/api.js - Updated for Beauty AI Platform
const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/database');

// Controllers
const searchController = require('../controllers/searchController');
const videoController = require('../controllers/videoController');
const { 
  PhotoController, 
  BeautyProfileController, 
  BeautyRecommendationController 
} = require('../controllers/beautyControllers');

// Middleware
const { 
  validateSearch, 
  validateProductDetails, 
  validateCompareProducts, 
  validateProductVideos, 
  validateVideosSummary 
} = require('../middleware/validation');
const { optionalAuth, authenticateToken } = require('../middleware/auth');

// Import route modules
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const activityRoutes = require('./activityRoutes');
const aiAnalysisRoutes = require('./aiAnalysisRoutes');

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Health check
router.get('/health', searchController.healthCheck);

// ==========================================
// EXISTING ROUTES (kept for compatibility)
// ==========================================

// Authentication routes
router.use('/auth', authRoutes);

// Profile management routes (original)
router.use('/profile', profileRoutes);

// Activity tracking routes
router.use('/activity', activityRoutes);

// AI analysis routes (original)
router.use('/ai', aiAnalysisRoutes);

// Search products - with optional authentication for personalization
router.post('/search', optionalAuth, validateSearch, searchController.search);

// Get product details
router.get('/products/:productId', validateProductDetails, searchController.getProductDetails);

// Compare products
router.post('/compare', validateCompareProducts, searchController.compareProducts);

// Video content endpoints
router.get('/products/:productId/videos', validateProductVideos, videoController.getProductVideos);
router.get('/videos/products-summary', validateVideosSummary, videoController.getVideosSummary);

// ==========================================
// NEW BEAUTY AI ROUTES
// ==========================================

// Photo Upload & 3D Face Model Routes
router.post(
  '/photo/upload', 
  authenticateToken, 
  upload.single('photo'), 
  PhotoController.uploadPhoto
);

router.get(
  '/photo/status/:session_id', 
  authenticateToken, 
  PhotoController.getPhotoStatus
);

router.post(
  '/photo/analyze', 
  authenticateToken, 
  PhotoController.analyzePhoto
);

// Beauty Profile Routes
router.get(
  '/profile/beauty', 
  authenticateToken, 
  BeautyProfileController.getCompleteProfile
);

router.get(
  '/profile/beauty/complete', 
  authenticateToken, 
  BeautyProfileController.getCompleteProfile
);

router.get(
  '/profile/beauty/onboarding', 
  authenticateToken, 
  BeautyProfileController.getCompleteProfile
);

router.put(
  '/profile/beauty/skin', 
  authenticateToken, 
  BeautyProfileController.updateSkinProfile
);

router.put(
  '/profile/beauty/hair', 
  authenticateToken, 
  BeautyProfileController.updateHairProfile
);

router.put(
  '/profile/beauty/lifestyle', 
  authenticateToken, 
  BeautyProfileController.updateLifestyleProfile
);

router.put(
  '/profile/beauty/health', 
  authenticateToken, 
  BeautyProfileController.updateHealthProfile
);

router.put(
  '/profile/beauty/makeup', 
  authenticateToken, 
  BeautyProfileController.updateMakeupProfile
);

// Beauty Recommendations Routes
router.get(
  '/recommendations/beauty', 
  authenticateToken, 
  BeautyRecommendationController.getRecommendations
);

router.post(
  '/recommendations/feedback', 
  authenticateToken, 
  BeautyRecommendationController.submitFeedback
);

// Progress Tracking Routes
router.post(
  '/progress/photo', 
  authenticateToken, 
  upload.single('photo'), 
  async (req, res) => {
    try {
      const { user } = req;
      const { week_number } = req.body;
      
      // Upload progress photo
      const result = await photoAnalysisService.uploadAndProcessPhoto(
        user.id,
        req.file.buffer,
        'progress'
      );

      // Create progress entry
      const { data, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          week_number: parseInt(week_number),
          progress_photo_id: result.photo_id
        })
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: {
          progress_id: data.id,
          photo_id: result.photo_id,
          processing_status: result.processing_status
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to upload progress photo'
      });
    }
  }
);

router.get(
  '/progress/timeline', 
  authenticateToken, 
  async (req, res) => {
    try {
      const { user } = req;
      
      // Import the service at the top of the file
      const beautyProgressService = require('../services/beautyProgressService');
      
      const timeline = await beautyProgressService.getProgressTimeline(user.id);
      
      res.status(200).json({
        success: true,
        data: timeline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get progress timeline'
      });
    }
  }
);

// Routine Tracking Routes
router.post(
  '/routine/track',
  authenticateToken,
  async (req, res) => {
    try {
      const { user } = req;
      const {
        date,
        morning_completed,
        evening_completed,
        skipped_products,
        skin_feeling,
        notes
      } = req.body;

      const { data, error } = await supabase
        .from('routine_tracking')
        .upsert({
          user_id: user.id,
          date: date || new Date().toISOString().split('T')[0],
          morning_completed,
          evening_completed,
          skipped_products,
          skin_feeling,
          notes
        }, {
          onConflict: 'user_id,date'
        })
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Routine tracked successfully',
        data: data
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to track routine'
      });
    }
  }
);

router.get(
  '/routine/history',
  authenticateToken,
  async (req, res) => {
    try {
      const { user } = req;
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const { data, error } = await supabase
        .from('routine_tracking')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      // Calculate adherence rate
      const totalDays = parseInt(days);
      const trackedDays = data.length;
      const completedDays = data.filter(d => d.morning_completed || d.evening_completed).length;
      const adherenceRate = (completedDays / totalDays) * 100;

      res.status(200).json({
        success: true,
        data: {
          history: data,
          statistics: {
            total_days: totalDays,
            tracked_days: trackedDays,
            completed_days: completedDays,
            adherence_rate: adherenceRate.toFixed(1)
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get routine history'
      });
    }
  }
);

module.exports = router;