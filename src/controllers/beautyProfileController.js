// src/controllers/beautyProfileController.js
const beautyProfileService = require('../services/beautyProfileService');
const Logger = require('../utils/logger');

class BeautyProfileController {
  /**
   * Get complete beauty profile status
   */
  async getCompleteProfile(req, res) {
    try {
      const { user } = req;

      // Get complete profile information
      const profileData = await beautyProfileService.getProfile(user.id);

      res.status(200).json({
        success: true,
        data: {
          profile: profileData.profile,
          completion: profileData.completion,
          onboardingStatus: profileData.onboardingStatus,
          isNewUser: profileData.isNewUser
        }
      });

    } catch (error) {
      Logger.error('Get complete profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get profile status'
      });
    }
  }

  /**
   * Update skin profile
   */
  async updateSkinProfile(req, res) {
    try {
      const { user } = req;
      const skinData = req.body;

      // Update skin profile using unified service
      const result = await beautyProfileService.updateProfile(user.id, 'skin', skinData);

      res.status(200).json({
        success: true,
        message: 'Skin profile updated successfully',
        data: result.profile,
        section: result.section,
        onboardingStatus: result.onboardingStatus
      });

    } catch (error) {
      Logger.error('Update skin profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update skin profile'
      });
    }
  }

  /**
   * Update hair profile
   */
  async updateHairProfile(req, res) {
    try {
      const { user } = req;
      const hairData = req.body;

      // Update hair profile using unified service
      const result = await beautyProfileService.updateProfile(user.id, 'hair', hairData);

      res.status(200).json({
        success: true,
        message: 'Hair profile updated successfully',
        data: result.profile,
        section: result.section,
        onboardingStatus: result.onboardingStatus
      });

    } catch (error) {
      Logger.error('Update hair profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update hair profile'
      });
    }
  }

  /**
   * Update lifestyle demographics
   */
  async updateLifestyleProfile(req, res) {
    try {
      const { user } = req;
      const lifestyleData = req.body;

      // Update lifestyle profile using unified service
      const result = await beautyProfileService.updateProfile(user.id, 'lifestyle', lifestyleData);

      res.status(200).json({
        success: true,
        message: 'Lifestyle profile updated successfully',
        data: result.profile,
        section: result.section,
        onboardingStatus: result.onboardingStatus
      });

    } catch (error) {
      Logger.error('Update lifestyle profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update lifestyle profile'
      });
    }
  }

  /**
   * Update health/medical profile
   */
  async updateHealthProfile(req, res) {
    try {
      const { user } = req;
      const healthData = req.body;

      // Update health profile using unified service
      const result = await beautyProfileService.updateProfile(user.id, 'health', healthData);

      res.status(200).json({
        success: true,
        message: 'Health profile updated successfully',
        data: result.profile,
        section: result.section,
        onboardingStatus: result.onboardingStatus
      });

    } catch (error) {
      Logger.error('Update health profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update health profile'
      });
    }
  }

  /**
   * Update makeup preferences
   */
  async updateMakeupProfile(req, res) {
    try {
      const { user } = req;
      const makeupData = req.body;

      // Update makeup profile using unified service
      const result = await beautyProfileService.updateProfile(user.id, 'makeup', makeupData);

      res.status(200).json({
        success: true,
        message: 'Makeup preferences updated successfully',
        data: result.profile,
        section: result.section,
        onboardingStatus: result.onboardingStatus
      });

    } catch (error) {
      Logger.error('Update makeup profile error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update makeup preferences'
      });
    }
  }
}

module.exports = new BeautyProfileController(); 