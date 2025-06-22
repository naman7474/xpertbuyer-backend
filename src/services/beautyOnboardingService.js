const supabase = require('../config/database');
const Logger = require('../utils/logger');
const beautyRecommendationService = require('./beautyRecommendationService');
const { checkProfileCompletion } = require('../constants/profileFields');

class BeautyOnboardingService {
  /**
   * Check if user has completed onboarding and trigger recommendations if ready
   */
  async checkAndTriggerRecommendations(userId) {
    try {
      Logger.info('Checking onboarding status for recommendations', { userId });

      // Get user's profile and check completion
      const { data: profile, error: profileError } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        Logger.info('User profile not found', { userId });
        return {
          triggered: false,
          reason: 'profile_not_found',
          profileCompletion: 0
        };
      }

      // Check profile completion
      const completion = checkProfileCompletion(profile);
      
      if (completion.overall < 100) {
        Logger.info('Profile incomplete', { 
          userId, 
          completion: completion.overall,
          missing: completion.missingFields 
        });
        return {
          triggered: false,
          reason: 'profile_incomplete',
          profileCompletion: completion.overall,
          missingFields: completion.missingFields
        };
      }

      // Check if user has uploaded and processed photo
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
        Logger.info('No completed photo analysis found', { userId });
        return {
          triggered: false,
          reason: 'photo_analysis_pending',
          profileCompletion: completion.overall
        };
      }

      // Check if recommendations already exist for this analysis
      const { data: existingRecs, error: recsError } = await supabase
        .from('product_recommendations')
        .select('id')
        .eq('user_id', userId)
        .eq('analysis_id', latestPhoto.photo_analyses[0].id)
        .limit(1);

      if (!recsError && existingRecs && existingRecs.length > 0) {
        Logger.info('Recommendations already exist for this analysis', { 
          userId, 
          analysisId: latestPhoto.photo_analyses[0].id 
        });
        return {
          triggered: false,
          reason: 'recommendations_exist',
          profileCompletion: completion.overall,
          analysisId: latestPhoto.photo_analyses[0].id
        };
      }

      // All conditions met - trigger recommendations
      Logger.info('Triggering automatic recommendations', { 
        userId,
        analysisId: latestPhoto.photo_analyses[0].id 
      });

      const recommendations = await beautyRecommendationService.generateRecommendations(userId);

      return {
        triggered: true,
        reason: 'success',
        profileCompletion: completion.overall,
        analysisId: latestPhoto.photo_analyses[0].id,
        recommendationCount: {
          morning: recommendations.routine.morning.length,
          evening: recommendations.routine.evening.length,
          weekly: recommendations.routine.weekly?.length || 0
        }
      };

    } catch (error) {
      Logger.error('Error checking/triggering recommendations', { 
        error: error.message, 
        userId 
      });
      return {
        triggered: false,
        reason: 'error',
        error: error.message
      };
    }
  }

  /**
   * Called after profile update to check if onboarding is complete
   */
  async onProfileUpdate(userId, updatedSection) {
    try {
      Logger.info('Profile updated, checking for auto-recommendations', { 
        userId, 
        updatedSection 
      });

      const result = await this.checkAndTriggerRecommendations(userId);
      
      if (result.triggered) {
        // Send notification or update user status
        await this.notifyRecommendationsReady(userId);
      }

      return result;

    } catch (error) {
      Logger.error('Error on profile update', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Called after photo analysis completes
   */
  async onPhotoAnalysisComplete(userId, photoId, analysisId) {
    try {
      Logger.info('Photo analysis complete, checking for auto-recommendations', { 
        userId, 
        photoId,
        analysisId 
      });

      const result = await this.checkAndTriggerRecommendations(userId);
      
      if (result.triggered) {
        // Send notification or update user status
        await this.notifyRecommendationsReady(userId);
      }

      return result;

    } catch (error) {
      Logger.error('Error on photo analysis complete', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Notify user that recommendations are ready
   */
  async notifyRecommendationsReady(userId) {
    try {
      // Update user's onboarding status
      const { error } = await supabase
        .from('beauty_profiles')
        .update({
          onboarding_completed_at: new Date().toISOString(),
          recommendations_generated: true
        })
        .eq('user_id', userId);

      if (error) {
        Logger.error('Error updating onboarding status', { error: error.message });
      }

      // Here you would trigger any notification system
      // e.g., email, push notification, in-app notification
      Logger.info('User notified of recommendations ready', { userId });

    } catch (error) {
      Logger.error('Error notifying user', { error: error.message, userId });
    }
  }

  /**
   * Get onboarding progress for a user
   */
  async getOnboardingProgress(userId) {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get photo status
      const { data: photos } = await supabase
        .from('photo_uploads')
        .select('id, processing_status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      // Get recommendations status
      const { data: recommendations } = await supabase
        .from('product_recommendations')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      const profileCompletion = profile ? checkProfileCompletion(profile) : { overall: 0, isComplete: false };
      const hasPhoto = photos && photos.length > 0;
      const photoProcessed = hasPhoto && photos[0].processing_status === 'completed';
      const hasRecommendations = recommendations && recommendations.length > 0;

      return {
        steps: {
          profile: {
            complete: profileCompletion.isComplete,
            percentage: profileCompletion.overall,
            sections: profileCompletion.sections
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
          profileCompletion.isComplete,
          photoProcessed,
          hasRecommendations
        ),
        nextStep: this.determineNextStep(
          profileCompletion.isComplete,
          hasPhoto,
          photoProcessed,
          hasRecommendations
        )
      };

    } catch (error) {
      Logger.error('Error getting onboarding progress', { error: error.message, userId });
      throw error;
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
}

module.exports = new BeautyOnboardingService(); 