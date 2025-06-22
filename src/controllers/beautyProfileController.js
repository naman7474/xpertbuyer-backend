// src/controllers/beautyProfileController.js
const supabase = require('../config/database');
const beautyOnboardingService = require('../services/beautyOnboardingService');
const Logger = require('../utils/logger');

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

module.exports = new BeautyProfileController(); 