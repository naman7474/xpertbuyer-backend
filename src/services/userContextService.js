const supabase = require('../config/database');
const Logger = require('../utils/logger');

class UserContextService {
  /**
   * Get comprehensive user context for personalized search and recommendations
   */
  async getUserContext(userId) {
    try {
      // Get user profile with AI analysis
      const profile = await this.getUserCompleteProfile(userId);
      
      Logger.debug(`Getting user context for user ${userId}`, {
        hasProfile: !!profile,
        profileSections: profile ? Object.keys(profile).filter(key => Array.isArray(profile[key]) && profile[key].length > 0) : []
      });
      
      const latestAnalysis = await this.getLatestAIAnalysis(userId);
      const activeRecommendations = await this.getActiveRecommendations(userId);
      
      return {
        profile,
        aiInsights: latestAnalysis,
        recommendations: activeRecommendations,
        preferences: this.extractPreferences(profile, latestAnalysis)
      };
    } catch (error) {
      Logger.error('Error getting user context', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Get complete user profile with all related data
   */
  async getUserCompleteProfile(userId) {
    const { data: profile, error } = await supabase
      .from('users')
      .select(`
        id, email, first_name, last_name, phone, date_of_birth, gender, 
        profile_completed, created_at, updated_at,
        skin_profiles(*),
        hair_profiles(*),
        lifestyle_demographics(*),
        health_medical_conditions(*),
        makeup_preferences(*)
      `)
      .eq('id', userId)
      .single();

    if (error) {
      Logger.error('Error fetching user profile', { error: error.message, userId });
      return null;
    }

    return profile;
  }

  /**
   * Get latest AI analysis results for the user
   */
  async getLatestAIAnalysis(userId) {
    const { data: analyses, error } = await supabase
      .from('ai_analysis_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      Logger.error('Error fetching AI analysis', { error: error.message, userId });
      return [];
    }

    // Group by analysis type and get the latest for each
    const latestByType = {};
    analyses.forEach(analysis => {
      if (!latestByType[analysis.analysis_type] || 
          new Date(analysis.created_at) > new Date(latestByType[analysis.analysis_type].created_at)) {
        latestByType[analysis.analysis_type] = analysis;
      }
    });

    return latestByType;
  }

  /**
   * Get active recommendations for the user
   */
  async getActiveRecommendations(userId) {
    const { data: recommendations, error } = await supabase
      .from('ai_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      Logger.error('Error fetching recommendations', { error: error.message, userId });
      return [];
    }

    return recommendations;
  }

  /**
   * Extract structured preferences from profile and AI analysis
   */
  extractPreferences(profile, latestAnalysis) {
    if (!profile) {
      Logger.warn('extractPreferences called with null profile. Returning default preferences');
      // Return a default structure for preferences if profile is null
      // to avoid errors in subsequent code that expects prefs.profileCompleteness etc.
      return {
        skin: { skinType: null, concerns: [], sensitivity: null, avoidIngredients: [] },
        hair: { hairPattern: null, texture: null, concerns: [], avoidIngredients: [] },
        lifestyle: {},
        makeup: {},
        priceRange: 'mid-range',
        preferredIngredients: [],
        avoidIngredients: [],
        userSegment: 'Concern-Focused Novices',
        profileCompleteness: 0, // Default to 0 if no profile
        age: null,
        gender: null
      };
    }

    const skinProfile = profile.skin_profiles?.[0];
    const hairProfile = profile.hair_profiles?.[0];
    const lifestyleProfile = profile.lifestyle_demographics?.[0];
    const healthProfile = profile.health_medical_conditions?.[0];
    const makeupProfile = profile.makeup_preferences?.[0];

    // Extract skin-related preferences
    const skinPreferences = {
      skinType: skinProfile?.skin_type,
      skinTone: skinProfile?.skin_tone,
      undertone: skinProfile?.undertone,
      fitzpatrickType: skinProfile?.fitzpatrick_phototype,
      concerns: skinProfile?.primary_concerns || [],
      sensitivity: skinProfile?.skin_sensitivity,
      avoidIngredients: [
        ...(skinProfile?.known_allergies || []),
        ...(healthProfile?.allergies_intolerances || [])
      ],
      sunExposure: skinProfile?.daily_sun_exposure,
      sunscreenUsage: skinProfile?.sunscreen_usage
    };

    // Extract hair-related preferences  
    const hairPreferences = {
      hairPattern: hairProfile?.hair_pattern,
      hairTexture: hairProfile?.hair_texture,
      hairThickness: hairProfile?.hair_thickness,
      scalpType: hairProfile?.scalp_type,
      scalpConcerns: hairProfile?.scalp_concerns || [],
      hairConcerns: hairProfile?.hair_concerns || [],
      chemicalTreatments: hairProfile?.chemical_treatments,
      heatStylingFrequency: hairProfile?.heat_styling_frequency
    };

    // Extract lifestyle preferences
    const lifestylePreferences = {
      location: lifestyleProfile?.location,
      climate: lifestyleProfile?.climate,
      pollutionExposure: lifestyleProfile?.pollution_exposure,
      waterQuality: lifestyleProfile?.water_quality,
      diet: lifestyleProfile?.diet_pattern,
      exerciseFrequency: lifestyleProfile?.exercise_frequency,
      stressLevel: lifestyleProfile?.stress_level,
      sleepQuality: lifestyleProfile?.sleep_quality
    };

    // Extract makeup preferences
    const makeupPreferences = {
      foundationShade: makeupProfile?.foundation_shade,
      foundationUndertone: makeupProfile?.foundation_undertone,
      finishPreference: makeupProfile?.finish_preference,
      makeupStyle: makeupProfile?.makeup_style,
      makeupFrequency: makeupProfile?.makeup_frequency,
      favoriteColors: makeupProfile?.favorite_colors || []
    };

    // Calculate price range based on profile and activity
    const priceRange = this.calculatePriceRange(profile);

    // Extract ingredient preferences from AI analysis
    const ingredientPreferences = this.extractIngredientPreferences(latestAnalysis);

    // Determine user segment based on profile completeness and concerns
    const userSegment = this.determineUserSegment(profile, latestAnalysis);

    return {
      skin: skinPreferences,
      hair: hairPreferences,
      lifestyle: lifestylePreferences,
      makeup: makeupPreferences,
      priceRange,
      preferredIngredients: ingredientPreferences.beneficial || [],
      avoidIngredients: [
        ...skinPreferences.avoidIngredients,
        ...(ingredientPreferences.avoid || [])
      ],
      userSegment,
      profileCompleteness: this.calculateProfileCompleteness(profile),
      age: profile.date_of_birth ? 
        new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : null,
      gender: profile.gender
    };
  }

  /**
   * Calculate user's price sensitivity based on profile and behavior
   */
  calculatePriceRange(profile) {
    const lifestyleProfile = profile.lifestyle_demographics?.[0];
    
    // Default to mid-range if no data
    if (!lifestyleProfile) {
      return 'mid-range';
    }

    const income = lifestyleProfile.household_income;
    const spendingHabits = lifestyleProfile.beauty_spending_habits;

    // Map income and spending to price sensitivity
    if (income === 'high' || spendingHabits === 'premium') {
      return 'luxury';
    } else if (income === 'medium' && spendingHabits === 'moderate') {
      return 'premium';
    } else if (income === 'medium' || spendingHabits === 'moderate') {
      return 'mid-range';
    } else {
      return 'budget';
    }
  }

  /**
   * Extract ingredient preferences from AI analysis
   */
  extractIngredientPreferences(latestAnalysis) {
    const preferences = {
      beneficial: [],
      avoid: []
    };

    // Extract from skin analysis
    if (latestAnalysis.skin) {
      try {
        const skinAnalysis = typeof latestAnalysis.skin.analysis_result === 'string' 
          ? JSON.parse(latestAnalysis.skin.analysis_result)
          : latestAnalysis.skin.analysis_result;

        if (skinAnalysis.ingredient_recommendations) {
          preferences.beneficial.push(...(skinAnalysis.ingredient_recommendations.beneficial || []));
          preferences.avoid.push(...(skinAnalysis.ingredient_recommendations.avoid || []));
        }

        if (skinAnalysis.concern_analysis) {
          skinAnalysis.concern_analysis.forEach(concern => {
            if (concern.recommended_ingredients) {
              preferences.beneficial.push(...concern.recommended_ingredients);
            }
          });
        }
      } catch (error) {
        Logger.error('Error parsing skin analysis for ingredients', { error: error.message });
      }
    }

    // Extract from hair analysis
    if (latestAnalysis.hair) {
      try {
        const hairAnalysis = typeof latestAnalysis.hair.analysis_result === 'string'
          ? JSON.parse(latestAnalysis.hair.analysis_result)
          : latestAnalysis.hair.analysis_result;

        if (hairAnalysis.ingredient_recommendations) {
          preferences.beneficial.push(...(hairAnalysis.ingredient_recommendations.beneficial || []));
          preferences.avoid.push(...(hairAnalysis.ingredient_recommendations.avoid || []));
        }
      } catch (error) {
        Logger.error('Error parsing hair analysis for ingredients', { error: error.message });
      }
    }

    // Remove duplicates
    preferences.beneficial = [...new Set(preferences.beneficial)];
    preferences.avoid = [...new Set(preferences.avoid)];

    return preferences;
  }

  /**
   * Determine user segment based on profile and behavior
   */
  determineUserSegment(profile, latestAnalysis) {
    const skinProfile = profile.skin_profiles?.[0];
    const lifestyleProfile = profile.lifestyle_demographics?.[0];
    
    // Check for clean/organic preference
    if (lifestyleProfile?.beauty_preferences?.includes('organic') ||
        lifestyleProfile?.beauty_preferences?.includes('natural') ||
        lifestyleProfile?.beauty_preferences?.includes('paraben-free')) {
      return 'Clean/Organic Beauty Seekers';
    }

    // Check for ingredient consciousness
    if (latestAnalysis.skin || latestAnalysis.hair || 
        skinProfile?.known_allergies?.length > 0) {
      return 'Ingredient-Conscious';
    }

    // Check for value consciousness
    if (this.calculatePriceRange(profile) === 'budget') {
      return 'Value/Deal Hunters';
    }

    // Check for luxury preference
    if (this.calculatePriceRange(profile) === 'luxury') {
      return 'Luxury/Aspirational Shoppers';
    }

    // Check for brand focus (would need to track brand preferences from activity)
    // For now, default based on profile completeness
    if (profile.profile_completed) {
      return 'Ingredient-Conscious';
    }

    return 'Concern-Focused Novices';
  }

  /**
   * Calculate profile completeness percentage
   */
  calculateProfileCompleteness(profile) {
    const sections = [
      'skin_profiles',
      'hair_profiles', 
      'lifestyle_demographics',
      'health_medical_conditions',
      'makeup_preferences'
    ];

    const completedSections = sections.filter(section => {
      const sectionData = profile[section];
      
      // Handle both array and object formats from Supabase
      if (Array.isArray(sectionData)) {
        return sectionData.length > 0;
      } else if (sectionData && typeof sectionData === 'object') {
        // If it's an object (not null), consider it filled
        return true;
      }
      
      return false;
    }).length;

    Logger.debug(`Profile completeness calculation: ${completedSections}/${sections.length} sections completed`);
    sections.forEach(section => {
      const sectionData = profile[section];
      const isCompleted = Array.isArray(sectionData) ? sectionData.length > 0 : (sectionData && typeof sectionData === 'object');
      Logger.debug(`${section}: ${isCompleted ? '✅ Completed' : '❌ Missing'} (${Array.isArray(sectionData) ? 'array' : typeof sectionData})`);
    });

    return Math.round((completedSections / sections.length) * 100);
  }

  /**
   * Get default preferences for users without profiles
   */
  getDefaultPreferences() {
    return {
      skin: {
        skinType: null,
        concerns: [],
        sensitivity: 'medium',
        avoidIngredients: []
      },
      hair: {
        hairPattern: null,
        scalpConcerns: [],
        hairConcerns: []
      },
      lifestyle: {
        location: null,
        climate: null
      },
      makeup: {
        makeupFrequency: null
      },
      priceRange: 'mid-range',
      preferredIngredients: [],
      avoidIngredients: [],
      userSegment: 'Concern-Focused Novices',
      profileCompleteness: 0,
      age: null,
      gender: null
    };
  }

  /**
   * Check if user has sufficient profile data for personalization
   */
  hasPersonalizationData(userContext) {
    if (!userContext || !userContext.preferences) {
      return false;
    }

    const prefs = userContext.preferences;
    
    // Consider personalization available if user has:
    // - Basic skin info OR
    // - AI analysis insights OR 
    // - Lifestyle preferences OR
    // - Active recommendations
    return prefs.profileCompleteness > 20 ||
           (userContext.aiInsights && Object.keys(userContext.aiInsights).length > 0) ||
           (userContext.recommendations && userContext.recommendations.length > 0) ||
           prefs.skin.skinType ||
           prefs.skin.concerns.length > 0;
  }
}

module.exports = new UserContextService(); 