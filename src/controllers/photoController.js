// src/controllers/photoController.js
const photoAnalysisService = require('../services/photoAnalysisService');
const Logger = require('../utils/logger');

class PhotoController {
  /**
   * Upload and process photo
   */
  async uploadPhoto(req, res) {
    try {
      const { user } = req;
      const photoFile = req.file;
      const { photo_type = 'onboarding' } = req.body;

      if (!photoFile) {
        return res.status(400).json({
          success: false,
          error: 'No photo file provided'
        });
      }

      // Process photo
      const result = await photoAnalysisService.uploadAndProcessPhoto(
        user.id,
        photoFile.buffer,
        photo_type
      );

      res.status(200).json({
        success: true,
        data: {
          session_id: result.photo_id,
          photo_id: result.photo_id,
          processing_status: result.processing_status,
          estimated_time: 30
        }
      });

    } catch (error) {
      Logger.error('Photo upload error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to upload and process photo'
      });
    }
  }

  /**
   * Get photo processing status
   */
  async getPhotoStatus(req, res) {
    try {
      const { session_id } = req.params;

      const status = await photoAnalysisService.getPhotoStatus(session_id);

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      Logger.error('Get photo status error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get photo status'
      });
    }
  }

  /**
   * Analyze photo for skin concerns
   */
  async analyzePhoto(req, res) {
    try {
      const { user } = req;
      const { photo_id, analysis_type = 'comprehensive' } = req.body;

      // Get photo analysis results
      const { data: analysis, error } = await supabase
        .from('photo_analyses')
        .select('*')
        .eq('photo_id', photo_id)
        .eq('user_id', user.id)
        .single();

      if (error || !analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found or still processing'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          analysis_id: analysis.id,
          skin_concerns: analysis.skin_concerns,
          skin_attributes: analysis.skin_attributes,
          overall_skin_score: analysis.overall_skin_score,
          ai_observations: analysis.ai_observations,
          positive_attributes: analysis.positive_attributes
        }
      });

    } catch (error) {
      Logger.error('Analyze photo error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze photo'
      });
    }
  }
}

const supabase = require('../config/database');
const beautyOnboardingService = require('../services/beautyOnboardingService');

class BeautyProfileController {
  /**
   * Get complete beauty profile status
   */
  async getCompleteProfile(req, res) {
    try {
      const { user } = req;

      // Get onboarding progress
      const progress = await beautyOnboardingService.getOnboardingProgress(user.id);

      res.status(200).json({
        success: true,
        data: progress
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

      // Upsert beauty profile with skin data
      const { data, error } = await supabase
        .from('beauty_profiles')
        .upsert({
          user_id: user.id,
          skin_type: skinData.skin_type,
          skin_tone: skinData.skin_tone,
          undertone: skinData.undertone,
          primary_skin_concerns: skinData.primary_concerns,
          secondary_skin_concerns: skinData.secondary_concerns,
          skin_sensitivity_level: skinData.sensitivity_level,
          known_allergies: skinData.allergies,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Check and trigger recommendations if ready
      const recommendationResult = await beautyOnboardingService.onProfileUpdate(user.id, 'skin');

      res.status(200).json({
        success: true,
        message: 'Skin profile updated successfully',
        data: data,
        onboardingStatus: recommendationResult
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

      const { data, error } = await supabase
        .from('beauty_profiles')
        .upsert({
          user_id: user.id,
          hair_type: hairData.hair_type,
          hair_texture: hairData.hair_texture,
          hair_porosity: hairData.hair_porosity,
          scalp_condition: hairData.scalp_condition,
          hair_concerns: hairData.primary_concerns,
          chemical_treatments: hairData.chemical_treatments,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Check and trigger recommendations if ready
      const recommendationResult = await beautyOnboardingService.onProfileUpdate(user.id, 'hair');

      res.status(200).json({
        success: true,
        message: 'Hair profile updated successfully',
        data: data,
        onboardingStatus: recommendationResult
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

      const { data, error } = await supabase
        .from('beauty_profiles')
        .upsert({
          user_id: user.id,
          location_city: lifestyleData.location?.split(',')[0],
          location_country: lifestyleData.location?.split(',')[1]?.trim() || 'India',
          climate_type: lifestyleData.climate_type,
          pollution_level: lifestyleData.pollution_level,
          sun_exposure_daily: lifestyleData.sun_exposure,
          sleep_hours_avg: lifestyleData.sleep_hours,
          stress_level: lifestyleData.stress_level,
          exercise_frequency: lifestyleData.exercise_frequency,
          water_intake_daily: lifestyleData.water_intake,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Check and trigger recommendations if ready
      const recommendationResult = await beautyOnboardingService.onProfileUpdate(user.id, 'lifestyle');

      res.status(200).json({
        success: true,
        message: 'Lifestyle profile updated successfully',
        data: data,
        onboardingStatus: recommendationResult
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

      const { data, error } = await supabase
        .from('beauty_profiles')
        .upsert({
          user_id: user.id,
          age: healthData.age || new Date().getFullYear() - new Date(user.date_of_birth).getFullYear(),
          hormonal_status: healthData.hormonal_status,
          medications: healthData.medications || [],
          skin_medical_conditions: healthData.skin_conditions || [],
          dietary_type: healthData.dietary_restrictions?.[0] || 'omnivore',
          supplements: healthData.supplements || [],
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Check and trigger recommendations if ready
      const recommendationResult = await beautyOnboardingService.onProfileUpdate(user.id, 'health');

      res.status(200).json({
        success: true,
        message: 'Health profile updated successfully',
        data: data,
        onboardingStatus: recommendationResult
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

      const { data, error } = await supabase
        .from('beauty_profiles')
        .upsert({
          user_id: user.id,
          makeup_frequency: makeupData.makeup_frequency,
          preferred_look: makeupData.preferred_look,
          coverage_preference: makeupData.coverage_preference,
          budget_range: makeupData.budget_range,
          favorite_brands: makeupData.favorite_brands || [],
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Check and trigger recommendations if ready
      const recommendationResult = await beautyOnboardingService.onProfileUpdate(user.id, 'makeup');

      res.status(200).json({
        success: true,
        message: 'Makeup preferences updated successfully',
        data: data,
        onboardingStatus: recommendationResult
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

const beautyRecommendationService = require('../services/beautyRecommendationService');

class BeautyRecommendationController {
  /**
   * Get personalized beauty recommendations
   */
  async getRecommendations(req, res) {
    try {
      const { user } = req;

      // Generate or retrieve recommendations
      const recommendations = await beautyRecommendationService.generateRecommendations(user.id);

      res.status(200).json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      Logger.error('Get recommendations error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations'
      });
    }
  }

  /**
   * Submit feedback on recommendation
   */
  async submitFeedback(req, res) {
    try {
      const { user } = req;
      const {
        recommendation_id,
        product_id,
        feedback_type,
        comments,
        rating
      } = req.body;

      // Update recommendation with feedback
      const { error } = await supabase
        .from('product_recommendations')
        .update({
          user_rating: rating,
          user_feedback: comments,
          marked_effective: feedback_type === 'positive',
          updated_at: new Date().toISOString()
        })
        .eq('id', recommendation_id)
        .eq('user_id', user.id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      Logger.error('Submit feedback error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback'
      });
    }
  }
}

module.exports = {
  PhotoController: new PhotoController(),
  BeautyProfileController: new BeautyProfileController(),
  BeautyRecommendationController: new BeautyRecommendationController()
};