const supabase = require('../config/database');
const Logger = require('../utils/logger');
const beautyRecommendationService = require('./beautyRecommendationService');
const { checkProfileCompletion } = require('../constants/profileFields');

class BeautyProfileService {
  /**
   * Get user's complete beauty profile with status
   */
  async getProfile(userId) {
    try {
      Logger.info('Getting beauty profile', { userId });

      // Get the beauty profile
      const { data: profile, error: profileError } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      // If no profile exists, return empty profile structure
      if (!profile) {
        return {
          profile: null,
          completion: { overall: 0, isComplete: false, sections: {}, missingFields: [] },
          onboardingStatus: await this.getOnboardingStatus(userId),
          isNewUser: true
        };
      }

      // Check profile completion
      const completion = checkProfileCompletion(profile);

      // Get onboarding status
      const onboardingStatus = await this.getOnboardingStatus(userId);

      return {
        profile,
        completion,
        onboardingStatus,
        isNewUser: false
      };

    } catch (error) {
      Logger.error('Get profile error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update any section of the beauty profile
   * This method handles both onboarding and regular profile updates
   */
  async updateProfile(userId, section, data) {
    try {
      Logger.info('Updating profile section', { userId, section });

      // Get current profile or create base structure
      const { data: currentProfile } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Prepare update data based on section
      const updateData = this.prepareUpdateData(section, data, currentProfile);
      updateData.user_id = userId;
      updateData.updated_at = new Date().toISOString();

      // Upsert the profile
      const { data: updatedProfile, error } = await supabase
        .from('beauty_profiles')
        .upsert(updateData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        Logger.error('Profile update error', { error: error.message, section, userId });
        throw error;
      }

      // Check if profile is now complete and handle onboarding logic
      const onboardingResult = await this.handleProfileUpdate(userId, section, updatedProfile);

      return {
        profile: updatedProfile,
        section,
        onboardingStatus: onboardingResult
      };

    } catch (error) {
      Logger.error('Update profile error', { error: error.message, section, userId });
      throw error;
    }
  }

  /**
   * Prepare update data based on section
   */
  prepareUpdateData(section, data, currentProfile = {}) {
    const updateData = { ...currentProfile };

    switch (section) {
      case 'skin':
        return {
          ...updateData,
          skin_type: data.skin_type,
          skin_tone: data.skin_tone,
          undertone: data.undertone,
          primary_skin_concerns: data.primary_concerns,
          secondary_skin_concerns: data.secondary_concerns,
          skin_sensitivity_level: data.sensitivity_level,
          known_allergies: data.allergies
        };

      case 'hair':
        return {
          ...updateData,
          hair_type: data.hair_type,
          hair_texture: data.hair_texture,
          hair_porosity: data.hair_porosity,
          scalp_condition: data.scalp_condition,
          hair_concerns: data.primary_concerns,
          chemical_treatments: data.chemical_treatments
        };

      case 'lifestyle':
        const locationParts = data.location ? data.location.split(',') : ['', ''];
        return {
          ...updateData,
          location_city: locationParts[0]?.trim(),
          location_country: locationParts[1]?.trim() || 'India',
          climate_type: data.climate_type,
          pollution_level: data.pollution_level,
          sun_exposure_daily: data.sun_exposure,
          sleep_hours_avg: data.sleep_hours,
          stress_level: data.stress_level,
          exercise_frequency: data.exercise_frequency,
          water_intake_daily: data.water_intake
        };

      case 'health':
        return {
          ...updateData,
          age: data.age,
          hormonal_status: data.hormonal_status,
          medications: data.medications || [],
          skin_medical_conditions: data.skin_conditions || [],
          dietary_type: data.dietary_restrictions?.[0] || 'omnivore',
          supplements: data.supplements || []
        };

      case 'makeup':
        return {
          ...updateData,
          makeup_frequency: data.makeup_frequency,
          preferred_look: data.preferred_look,
          coverage_preference: data.coverage_preference,
          budget_range: data.budget_range,
          favorite_brands: data.favorite_brands || []
        };

      default:
        Logger.warn('Unknown profile section', { section });
        return updateData;
    }
  }

  /**
   * Handle post-update logic (onboarding, recommendations)
   */
  async handleProfileUpdate(userId, section, updatedProfile) {
    try {
      // Check profile completion
      const completion = checkProfileCompletion(updatedProfile);
      
      Logger.info('Profile update completion check', { 
        userId, 
        section, 
        completion: completion.overall 
      });

      // Check if we should trigger recommendations
      const shouldTriggerRecommendations = await this.shouldTriggerRecommendations(
        userId, 
        completion
      );

      if (shouldTriggerRecommendations.should) {
        Logger.info('Triggering automatic recommendations', { userId, reason: shouldTriggerRecommendations.reason });
        
        try {
          const recommendations = await beautyRecommendationService.generateRecommendations(userId);
          
          // Mark recommendations as generated
          await this.markRecommendationsGenerated(userId);
          
          return {
            triggered: true,
            reason: 'recommendations_generated',
            profileCompletion: completion.overall,
            recommendationCount: {
              morning: recommendations.routine?.morning?.length || 0,
              evening: recommendations.routine?.evening?.length || 0,
              weekly: recommendations.routine?.weekly?.length || 0
            }
          };
        } catch (recError) {
          Logger.error('Auto recommendation generation failed', { error: recError.message, userId });
        }
      }

      return {
        triggered: false,
        reason: shouldTriggerRecommendations.reason,
        profileCompletion: completion.overall,
        missingFields: completion.missingFields
      };

    } catch (error) {
      Logger.error('Handle profile update error', { error: error.message, userId });
      return {
        triggered: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check if we should trigger recommendations
   */
  async shouldTriggerRecommendations(userId, completion) {
    // Profile must be complete
    if (!completion.isComplete) {
      return {
        should: false,
        reason: 'profile_incomplete',
        missing: completion.missingFields
      };
    }

    // Check if user has a processed photo
    const { data: latestPhoto, error: photoError } = await supabase
      .from('photo_uploads')
      .select(`
        *,
        photo_analyses(*)
      `)
      .eq('user_id', userId)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (photoError || !latestPhoto || !latestPhoto.photo_analyses?.[0]) {
      return {
        should: false,
        reason: 'photo_analysis_pending'
      };
    }

    // Check if recommendations already exist for this analysis
    const { data: existingRecs } = await supabase
      .from('product_recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('analysis_id', latestPhoto.photo_analyses[0].id)
      .limit(1);

    if (existingRecs && existingRecs.length > 0) {
      return {
        should: false,
        reason: 'recommendations_exist'
      };
    }

    return {
      should: true,
      reason: 'conditions_met',
      analysisId: latestPhoto.photo_analyses[0].id
    };
  }

  /**
   * Mark recommendations as generated in the profile
   */
  async markRecommendationsGenerated(userId) {
    const { error } = await supabase
      .from('beauty_profiles')
      .update({
        onboarding_completed_at: new Date().toISOString(),
        recommendations_generated: true
      })
      .eq('user_id', userId);

    if (error) {
      Logger.error('Error marking recommendations generated', { error: error.message });
    }
  }

  /**
   * Get onboarding status and progress
   */
  async getOnboardingStatus(userId) {
    try {
      // Get profile completion
      const { profile, completion } = await this.getProfile(userId);

      // Get photo status
      const { data: photos } = await supabase
        .from('photo_uploads')
        .select('id, processing_status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      // Get recommendations status
      const { data: recommendations } = await supabase
        .from('product_recommendations')
        .select('id, created_at')
        .eq('user_id', userId)
        .limit(1);

      const hasPhoto = photos && photos.length > 0;
      const photoProcessed = hasPhoto && photos[0].processing_status === 'completed';
      const hasRecommendations = recommendations && recommendations.length > 0;

      return {
        steps: {
          profile: {
            complete: completion?.isComplete || false,
            percentage: completion?.overall || 0,
            sections: completion?.sections || {},
            missingFields: completion?.missingFields || []
          },
          photo: {
            uploaded: hasPhoto,
            processed: photoProcessed,
            status: hasPhoto ? photos[0].processing_status : 'not_uploaded'
          },
          recommendations: {
            generated: hasRecommendations
          }
        },
        overallProgress: this.calculateOverallProgress(
          completion?.isComplete || false,
          photoProcessed,
          hasRecommendations
        ),
        nextStep: this.determineNextStep(
          completion?.isComplete || false,
          hasPhoto,
          photoProcessed,
          hasRecommendations
        ),
        isOnboardingComplete: hasRecommendations
      };

    } catch (error) {
      Logger.error('Get onboarding status error', { error: error.message, userId });
      return {
        steps: { profile: { complete: false, percentage: 0 }, photo: {}, recommendations: {} },
        overallProgress: 0,
        nextStep: 'complete_profile',
        isOnboardingComplete: false
      };
    }
  }

  /**
   * Calculate overall onboarding progress
   */
  calculateOverallProgress(profileComplete, photoProcessed, hasRecommendations) {
    let progress = 0;
    
    if (profileComplete) progress += 40;
    if (photoProcessed) progress += 40;
    if (hasRecommendations) progress += 20;
    
    return progress;
  }

  /**
   * Determine next onboarding step
   */
  determineNextStep(profileComplete, hasPhoto, photoProcessed, hasRecommendations) {
    if (!profileComplete) return 'complete_profile';
    if (!hasPhoto) return 'upload_photo';
    if (!photoProcessed) return 'processing_photo';
    if (!hasRecommendations) return 'generating_recommendations';
    return 'onboarding_complete';
  }

  /**
   * Handle photo analysis completion
   * Called by photo service when analysis is complete
   */
  async onPhotoAnalysisComplete(userId, photoId, analysisId) {
    try {
      Logger.info('Photo analysis complete, checking for auto-recommendations', { 
        userId, 
        photoId,
        analysisId 
      });

      // Get current profile
      const { profile, completion } = await this.getProfile(userId);
      
      if (!profile) {
        return { triggered: false, reason: 'no_profile' };
      }

      // Check if we should trigger recommendations
      const shouldTrigger = await this.shouldTriggerRecommendations(userId, completion);
      
      if (shouldTrigger.should) {
        try {
          const recommendations = await beautyRecommendationService.generateRecommendations(userId);
          await this.markRecommendationsGenerated(userId);
          
          return {
            triggered: true,
            reason: 'photo_analysis_complete',
            recommendationCount: {
              morning: recommendations.routine?.morning?.length || 0,
              evening: recommendations.routine?.evening?.length || 0,
              weekly: recommendations.routine?.weekly?.length || 0
            }
          };
        } catch (recError) {
          Logger.error('Auto recommendation generation failed after photo', { error: recError.message, userId });
        }
      }

      return {
        triggered: false,
        reason: shouldTrigger.reason
      };

    } catch (error) {
      Logger.error('Error on photo analysis complete', { error: error.message, userId });
      return { triggered: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Get profile summary for recommendations
   */
  async getProfileForRecommendations(userId) {
    try {
      const { data: profile, error } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return profile;

    } catch (error) {
      Logger.error('Get profile for recommendations error', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = new BeautyProfileService(); 