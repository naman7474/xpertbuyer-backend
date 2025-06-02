const express = require('express');
const router = express.Router();

const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateSkinProfile,
  validateHairProfile,
  validateLifestyleDemographics,
  validateHealthMedicalConditions,
  validateMakeupPreferences
} = require('../middleware/validation');

// Complete profile
router.get('/complete', authenticateToken, profileController.getCompleteProfile);

// Skin profile routes
router.get('/skin', authenticateToken, profileController.getSkinProfile);
router.put('/skin', authenticateToken, validateSkinProfile, profileController.updateSkinProfile);
router.post('/skin/upload-photo', authenticateToken, profileController.uploadFacePhoto);

// Hair profile routes
router.get('/hair', authenticateToken, profileController.getHairProfile);
router.put('/hair', authenticateToken, validateHairProfile, profileController.updateHairProfile);

// Lifestyle demographics routes
router.get('/lifestyle', authenticateToken, profileController.getLifestyleDemographics);
router.put('/lifestyle', authenticateToken, validateLifestyleDemographics, profileController.updateLifestyleDemographics);

// Health medical conditions routes
router.get('/health', authenticateToken, profileController.getHealthMedicalConditions);
router.put('/health', authenticateToken, validateHealthMedicalConditions, profileController.updateHealthMedicalConditions);

// Makeup preferences routes
router.get('/makeup', authenticateToken, profileController.getMakeupPreferences);
router.put('/makeup', authenticateToken, validateMakeupPreferences, profileController.updateMakeupPreferences);

module.exports = router; 