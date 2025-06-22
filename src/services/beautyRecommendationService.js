// src/services/beautyRecommendationService.js
const { models } = require('../config/gemini');
const supabase = require('../config/database');
const Logger = require('../utils/logger');
const productService = require('./productService');

class BeautyRecommendationService {
  constructor() {
    // Face zones for 3D mapping
    this.faceZones = {
      forehead: { x: 0.5, y: 0.8, z: 0.15, radius: 0.2 },
      left_cheek: { x: 0.3, y: 0.5, z: 0.12, radius: 0.15 },
      right_cheek: { x: 0.7, y: 0.5, z: 0.12, radius: 0.15 },
      nose: { x: 0.5, y: 0.5, z: 0.18, radius: 0.1 },
      chin: { x: 0.5, y: 0.2, z: 0.14, radius: 0.12 },
      left_eye: { x: 0.35, y: 0.65, z: 0.13, radius: 0.08 },
      right_eye: { x: 0.65, y: 0.65, z: 0.13, radius: 0.08 },
      under_eyes: { x: 0.5, y: 0.6, z: 0.13, radius: 0.2 },
      mouth: { x: 0.5, y: 0.3, z: 0.15, radius: 0.1 },
      full_face: { x: 0.5, y: 0.5, z: 0.1, radius: 0.5 }
    };

    // Product application mappings
    this.productApplicationZones = {
      cleanser: ['full_face'],
      toner: ['full_face'],
      serum: ['full_face', 'targeted'],
      moisturizer: ['full_face'],
      sunscreen: ['full_face'],
      eye_cream: ['under_eyes', 'left_eye', 'right_eye'],
      spot_treatment: ['targeted'],
      face_mask: ['full_face', 'exclude_eyes'],
      lip_care: ['mouth'],
      exfoliant: ['full_face', 'avoid_eyes']
    };
  }

  /**
   * Generate personalized beauty recommendations
   */
  async generateRecommendations(userId) {
    try {
      Logger.info('Generating beauty recommendations', { userId });

      // Get user's complete profile and analysis
      const [userProfile, latestAnalysis] = await Promise.all([
        this.getUserCompleteProfile(userId),
        this.getLatestSkinAnalysis(userId)
      ]);

      if (!userProfile || !latestAnalysis) {
        throw new Error('Incomplete user data for recommendations');
      }

      // Generate recommendations using AI
      const recommendations = await this.generateAIRecommendations(
        userProfile,
        latestAnalysis
      );

      // Map products to 3D face coordinates
      const mappedRecommendations = await this.mapRecommendationsTo3D(
        recommendations,
        latestAnalysis.skin_concerns,
        userProfile
      );

      // Save recommendations to database
      await this.saveRecommendations(userId, mappedRecommendations, latestAnalysis.id);

      return mappedRecommendations;

    } catch (error) {
      Logger.error('Generate recommendations error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's complete beauty profile
   */
  async getUserCompleteProfile(userId) {
    try {
      // Get profile data directly from database to avoid circular dependency
      const { data: profile, error } = await supabase
        .from('beauty_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        Logger.error('Get user profile error', { error: error.message });
        return null;
      }

      return profile;
    } catch (error) {
      Logger.error('Get user profile error', { error: error.message });
      return null;
    }
  }

  /**
   * Get latest skin analysis
   */
  async getLatestSkinAnalysis(userId) {
    const { data, error } = await supabase
      .from('photo_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      Logger.error('Get latest analysis error', { error: error.message });
      return null;
    }

    return data;
  }

  /**
   * Generate AI recommendations using Gemini
   */
  async generateAIRecommendations(userProfile, skinAnalysis) {
    try {
      const prompt = `Based on the following user profile and skin analysis, recommend a personalized skincare routine.

USER PROFILE:
- Skin Type: ${userProfile.skin_type}
- Skin Tone: ${userProfile.skin_tone} with ${userProfile.undertone} undertone
- Primary Concerns: ${userProfile.primary_skin_concerns?.join(', ')}
- Allergies: ${userProfile.known_allergies?.join(', ') || 'None'}
- Climate: ${userProfile.climate_type} with ${userProfile.pollution_level} pollution
- Lifestyle: ${userProfile.stress_level} stress, ${userProfile.sleep_hours_avg}h sleep
- Budget: ${userProfile.budget_range}

SKIN ANALYSIS:
- Overall Skin Score: ${skinAnalysis.overall_skin_score}/100
- Detected Concerns: ${JSON.stringify(skinAnalysis.skin_concerns)}
- AI Observations: ${skinAnalysis.ai_observations?.join(', ')}

Recommend a complete skincare routine with:
1. Morning routine (4-5 steps max)
2. Evening routine (5-6 steps max)
3. Targeted treatments for specific concerns
4. Weekly treatments

For each product, specify:
- Product type (cleanser, serum, etc.)
- Key ingredients to look for
- Why it's recommended for this user
- Application instructions
- Expected results timeline

Focus on ${userProfile.primary_skin_concerns?.[0] || 'overall skin health'} as the primary concern.

Return as JSON with structure:
{
  "routine": {
    "morning": [
      {
        "step": number,
        "product_type": "string",
        "key_ingredients": ["string"],
        "recommendation_reason": "string",
        "usage_instructions": "string",
        "expected_results": "string"
      }
    ],
    "evening": [...],
    "weekly": [...]
  },
  "targeted_treatments": [
    {
      "concern": "string",
      "product_type": "string",
      "key_ingredients": ["string"],
      "application_areas": ["string"],
      "frequency": "string"
    }
  ],
  "ai_insights": {
    "primary_focus": "string",
    "routine_philosophy": "string",
    "expected_timeline": "string",
    "lifestyle_tips": ["string"]
  }
}`;

      const result = await models.flash.generateContent(prompt);
      const response = result.response.text();
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      Logger.error('AI recommendation generation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Map recommendations to 3D face coordinates
   */
  async mapRecommendationsTo3D(recommendations, skinConcerns, userProfile) {
    const mappedRoutine = {
      morning: [],
      evening: [],
      weekly: []
    };

    // Map morning routine
    for (let i = 0; i < recommendations.routine.morning.length; i++) {
      const step = recommendations.routine.morning[i];
      const mapped = await this.mapProductTo3D(step, skinConcerns, userProfile);
      mappedRoutine.morning.push(mapped);
    }

    // Map evening routine
    for (let i = 0; i < recommendations.routine.evening.length; i++) {
      const step = recommendations.routine.evening[i];
      const mapped = await this.mapProductTo3D(step, skinConcerns, userProfile);
      mappedRoutine.evening.push(mapped);
    }

    // Map weekly treatments
    if (recommendations.routine.weekly) {
      for (let i = 0; i < recommendations.routine.weekly.length; i++) {
        const step = recommendations.routine.weekly[i];
        const mapped = await this.mapProductTo3D(step, skinConcerns, userProfile);
        mappedRoutine.weekly.push(mapped);
      }
    }

    // Map targeted treatments with specific concern areas
    const mappedTargeted = [];
    for (const treatment of recommendations.targeted_treatments || []) {
      const concernAreas = this.getConcernAreas(treatment.concern, skinConcerns);
      mappedTargeted.push({
        ...treatment,
        application_zones: concernAreas
      });
    }

    return {
      routine: mappedRoutine,
      targeted_treatments: mappedTargeted,
      ai_insights: recommendations.ai_insights
    };
  }

  /**
   * Map a single product to 3D coordinates
   */
  async mapProductTo3D(productStep, skinConcerns, userProfile) {
    // Find matching product from database
    const matchedProduct = await this.findMatchingProduct(
      productStep.product_type,
      productStep.key_ingredients,
      userProfile
    );

    // Determine application areas
    const applicationAreas = this.getApplicationAreas(
      productStep.product_type,
      skinConcerns
    );

    // Generate 3D markers
    const markers = this.generate3DMarkers(applicationAreas);

    return {
      ...productStep,
      product_id: matchedProduct?.product_id || null,
      product_name: matchedProduct?.product_name || `${productStep.product_type} with ${productStep.key_ingredients[0]}`,
      brand: matchedProduct?.brand_name || 'Recommended',
      price: matchedProduct?.price_sale || matchedProduct?.price_mrp || 0,
      application_areas: applicationAreas,
      face_coordinates: {
        markers: markers,
        highlight_regions: applicationAreas
      },
      match_confidence: matchedProduct?.rating_avg ? 0.9 : null,
      match_reason: matchedProduct?.rating_avg ? `AI-matched product with rating ${matchedProduct.rating_avg}/10` : null
    };
  }

  /**
   * Find matching product from database using smart search
   */
  async findMatchingProduct(productType, keyIngredients, userProfile = null) {
    try {
      // Build a more sophisticated search query
      const ingredientQuery = keyIngredients.slice(0, 3).join(' '); // Use top 3 ingredients
      const searchQuery = `${productType} with ${ingredientQuery}`;
      
      Logger.info('Finding matching products', { 
        productType, 
        keyIngredients: keyIngredients.slice(0, 3),
        searchQuery 
      });

      // Use the smart search service
      const searchService = require('./searchService');
      const searchResults = await searchService.search(searchQuery, {
        limit: 5,
        includeIngredients: true,
        userId: userProfile?.user_id || null
      });

      if (searchResults.products && searchResults.products.length > 0) {
        // Return the best matching product
        const bestMatch = searchResults.products[0];
        
        Logger.info('Found matching product', {
          productId: bestMatch.id,
          productName: bestMatch.name,
          brand: bestMatch.brand,
          matchReason: bestMatch.matchReason
        });

        return {
          product_id: bestMatch.id,
          product_name: bestMatch.name,
          brand_name: bestMatch.brand,
          price_mrp: bestMatch.price.mrp,
          price_sale: bestMatch.price.sale,
          rating_avg: bestMatch.rating.average,
          rating_count: bestMatch.rating.count,
          images: bestMatch.images,
          match_confidence: 0.9, // High confidence for AI-matched products
          match_reason: bestMatch.matchReason
        };
      }

      Logger.warn('No matching product found', { productType, keyIngredients });
      return null;

    } catch (error) {
      Logger.error('Find matching product error', { error: error.message });
      return null;
    }
  }

  /**
   * Get application areas based on product type
   */
  getApplicationAreas(productType, skinConcerns) {
    const baseAreas = this.productApplicationZones[productType] || ['full_face'];
    
    // For targeted treatments, add specific concern areas
    if (baseAreas.includes('targeted')) {
      const concernAreas = [];
      for (const concern of skinConcerns) {
        concernAreas.push(...concern.locations);
      }
      return [...new Set(concernAreas)];
    }

    return baseAreas;
  }

  /**
   * Generate 3D markers for face zones
   */
  generate3DMarkers(areas) {
    const markers = [];
    
    for (const area of areas) {
      const zone = this.faceZones[area];
      if (zone) {
        // Add main marker
        markers.push({
          x: zone.x,
          y: zone.y,
          z: zone.z,
          type: 'primary'
        });

        // Add surrounding markers for full coverage
        if (area === 'full_face') {
          markers.push(
            { x: 0.5, y: 0.8, z: 0.15, type: 'coverage' },
            { x: 0.3, y: 0.5, z: 0.12, type: 'coverage' },
            { x: 0.7, y: 0.5, z: 0.12, type: 'coverage' },
            { x: 0.5, y: 0.2, z: 0.14, type: 'coverage' }
          );
        }
      }
    }

    return markers;
  }

  /**
   * Get specific areas for skin concerns
   */
  getConcernAreas(concernType, skinConcerns) {
    const areas = {};
    
    for (const concern of skinConcerns) {
      if (concern.type === concernType) {
        for (const location of concern.locations) {
          const zone = this.faceZones[location];
          if (zone) {
            areas[location] = zone;
          }
        }
      }
    }

    return areas;
  }

  /**
   * Save recommendations to database
   */
  async saveRecommendations(userId, recommendations, analysisId) {
    try {
      const recommendationRecords = [];

      // Process morning routine
      for (const item of recommendations.routine.morning) {
        recommendationRecords.push({
          user_id: userId,
          analysis_id: analysisId,
          product_id: item.product_id,
          product_name: item.product_name,
          brand_name: item.brand,
          price_mrp: item.price,
          recommendation_type: 'routine',
          routine_step: item.step,
          routine_time: 'morning',
          application_areas: item.application_areas,
          face_coordinates: item.face_coordinates,
          usage_instructions: item.usage_instructions,
          recommendation_reason: item.recommendation_reason,
          match_reason: item.match_reason || null,
          ai_match_score: item.match_confidence || 0.85,
          personalization_factors: {
            product_type: item.product_type,
            key_ingredients: item.key_ingredients,
            expected_results: item.expected_results
          },
          created_at: new Date().toISOString()
        });
      }

      // Process evening routine
      for (const item of recommendations.routine.evening) {
        recommendationRecords.push({
          user_id: userId,
          analysis_id: analysisId,
          product_id: item.product_id,
          product_name: item.product_name,
          brand_name: item.brand,
          price_mrp: item.price,
          recommendation_type: 'routine',
          routine_step: item.step,
          routine_time: 'evening',
          application_areas: item.application_areas,
          face_coordinates: item.face_coordinates,
          usage_instructions: item.usage_instructions,
          recommendation_reason: item.recommendation_reason,
          match_reason: item.match_reason || null,
          ai_match_score: item.match_confidence || 0.85,
          personalization_factors: {
            product_type: item.product_type,
            key_ingredients: item.key_ingredients,
            expected_results: item.expected_results
          },
          created_at: new Date().toISOString()
        });
      }

      // Process weekly treatments
      for (const item of recommendations.routine.weekly || []) {
        recommendationRecords.push({
          user_id: userId,
          analysis_id: analysisId,
          product_id: item.product_id,
          product_name: item.product_name,
          brand_name: item.brand,
          price_mrp: item.price,
          recommendation_type: 'routine',
          routine_step: item.step,
          routine_time: 'weekly',
          application_areas: item.application_areas,
          face_coordinates: item.face_coordinates,
          usage_instructions: item.usage_instructions,
          recommendation_reason: item.recommendation_reason,
          match_reason: item.match_reason || null,
          ai_match_score: item.match_confidence || 0.85,
          personalization_factors: {
            product_type: item.product_type,
            key_ingredients: item.key_ingredients,
            expected_results: item.expected_results
          },
          created_at: new Date().toISOString()
        });
      }

      // Insert all recommendations
      const { error } = await supabase
        .from('product_recommendations')
        .insert(recommendationRecords);

      if (error) {
        Logger.error('Save recommendations error', { error: error.message });
        throw error;
      }

      Logger.info('Saved recommendations to database', {
        userId,
        analysisId,
        totalRecommendations: recommendationRecords.length,
        morning: recommendations.routine.morning.length,
        evening: recommendations.routine.evening.length,
        weekly: (recommendations.routine.weekly || []).length
      });

    } catch (error) {
      Logger.error('Save recommendations error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's active recommendations
   */
  async getUserRecommendations(userId) {
    try {
      const { data, error } = await supabase
        .from('product_recommendations')
        .select(`
          *,
          products!inner(
            product_id,
            product_name,
            brand_name,
            price_mrp,
            price_sale,
            rating_avg,
            rating_count,
            product_images,
            benefits_extracted
          )
        `)
        .eq('user_id', userId)
        .order('routine_time', { ascending: true })
        .order('routine_step', { ascending: true });

      if (error) throw error;

      // Group by routine time
      const grouped = {
        morning: [],
        evening: [],
        weekly: [],
        targeted: []
      };

      for (const rec of data) {
        if (rec.recommendation_type === 'routine') {
          grouped[rec.routine_time].push(rec);
        } else {
          grouped.targeted.push(rec);
        }
      }

      return grouped;

    } catch (error) {
      Logger.error('Get user recommendations error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new BeautyRecommendationService();