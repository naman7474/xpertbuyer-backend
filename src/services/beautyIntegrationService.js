// src/services/beautyIntegrationService.js
const supabase = require('../config/database');
const Logger = require('../utils/logger');
const searchService = require('./searchService');
const aiAnalysisService = require('./aiAnalysisService');
const productService = require('./productService');
const videoService = require('./videoService');
const userContextService = require('./userContextService');
const beautyRecommendationService = require('./beautyRecommendationService');

class BeautyIntegrationService {
  /**
   * Integrate beauty profile with existing user context
   */
  async enhanceUserContext(userId) {
    try {
      // Get existing user context
      const baseContext = await userContextService.getUserContext(userId);
      
      // Get beauty-specific data
      const beautyProfile = await this.getBeautyProfile(userId);
      const latestAnalysis = await this.getLatestAnalysis(userId);
      const activeRoutine = await this.getActiveRoutine(userId);

      // Merge contexts
      const enhancedContext = {
        ...baseContext,
        beauty: {
          profile_completed: beautyProfile?.profile_completed || false,
          skin_type: beautyProfile?.skin_type,
          primary_concerns: beautyProfile?.primary_skin_concerns || [],
          skin_score: latestAnalysis?.overall_skin_score || null,
          routine_adherence: activeRoutine?.adherence_rate || 0,
          product_preferences: this.extractProductPreferences(beautyProfile, activeRoutine)
        }
      };

      // Update user context for personalized search
      await userContextService.updateUserContext(userId, enhancedContext);

      return enhancedContext;

    } catch (error) {
      Logger.error('Enhance user context error', { error: error.message });
      return baseContext;
    }
  }

  /**
   * Search products with beauty profile integration
   */
  async searchBeautyProducts(userId, query, options = {}) {
    try {
      // Enhance query with beauty context
      const beautyContext = await this.getBeautySearchContext(userId);
      
      // Modify search query to include skin concerns
      const enhancedQuery = this.enhanceSearchQuery(query, beautyContext);

      // Use existing search service with beauty filters
      const searchResults = await searchService.search(enhancedQuery, {
        ...options,
        userId,
        filters: {
          ...options.filters,
          skin_type: beautyContext.skin_type,
          concerns: beautyContext.concerns,
          ingredients_exclude: beautyContext.allergens
        }
      });

      // Rank results based on beauty profile
      const rankedResults = await this.rankByBeautyProfile(
        searchResults.data.products,
        beautyContext
      );

      return {
        ...searchResults,
        data: {
          ...searchResults.data,
          products: rankedResults,
          beauty_context_applied: true
        }
      };

    } catch (error) {
      Logger.error('Search beauty products error', { error: error.message });
      // Fallback to regular search
      return searchService.search(query, options);
    }
  }

  /**
   * Trigger AI analysis with beauty context
   */
  async triggerBeautyAIAnalysis(userId, analysisType = 'comprehensive') {
    try {
      // Get beauty-specific data
      const beautyData = await this.getComprehensiveBeautyData(userId);

      // Prepare input for AI analysis
      const analysisInput = {
        user_profile: beautyData.profile,
        skin_analysis: beautyData.latest_analysis,
        current_routine: beautyData.active_routine,
        progress_history: beautyData.progress_summary,
        product_feedback: beautyData.product_feedback
      };

      // Trigger enhanced AI analysis
      const analysis = await aiAnalysisService.triggerAnalysis(
        userId,
        analysisType,
        'beauty_comprehensive',
        analysisInput
      );

      // Post-process for beauty-specific insights
      const beautyInsights = await this.extractBeautyInsights(analysis);

      return {
        ...analysis,
        beauty_insights: beautyInsights
      };

    } catch (error) {
      Logger.error('Trigger beauty AI analysis error', { error: error.message });
      throw error;
    }
  }

  /**
   * Find video content for beauty recommendations
   */
  async findBeautyTutorials(productIds, concerns) {
    try {
      // Get videos for recommended products
      const productVideos = await Promise.all(
        productIds.map(id => videoService.getProductVideos(id))
      );

      // Search for concern-specific tutorials
      const tutorialQueries = concerns.map(concern => 
        `${concern} skincare routine tutorial`
      );

      const tutorialVideos = await Promise.all(
        tutorialQueries.map(query => 
          this.searchYouTubeVideos(query)
        )
      );

      // Merge and rank videos
      const allVideos = [
        ...productVideos.flat(),
        ...tutorialVideos.flat()
      ];

      const rankedVideos = this.rankVideosByRelevance(
        allVideos,
        concerns,
        productIds
      );

      return rankedVideos.slice(0, 10); // Top 10 videos

    } catch (error) {
      Logger.error('Find beauty tutorials error', { error: error.message });
      return [];
    }
  }

  /**
   * Generate shopping list from recommendations
   */
  async generateShoppingList(userId) {
    try {
      // Get active recommendations
      const recommendations = await beautyRecommendationService.getUserRecommendations(userId);

      // Group products by category and priority
      const shoppingList = {
        essentials: [],
        recommended: [],
        optional: [],
        total_items: 0,
        estimated_cost: 0
      };

      // Process morning routine
      for (const item of recommendations.morning || []) {
        const product = await this.enhanceProductInfo(item.product_id);
        const category = this.categorizeProduct(item, 'morning');
        
        shoppingList[category].push({
          ...product,
          routine_time: 'morning',
          step: item.step,
          usage_instructions: item.usage_instructions
        });
      }

      // Process evening routine
      for (const item of recommendations.evening || []) {
        const product = await this.enhanceProductInfo(item.product_id);
        const category = this.categorizeProduct(item, 'evening');
        
        shoppingList[category].push({
          ...product,
          routine_time: 'evening',
          step: item.step,
          usage_instructions: item.usage_instructions
        });
      }

      // Calculate totals
      shoppingList.total_items = 
        shoppingList.essentials.length + 
        shoppingList.recommended.length + 
        shoppingList.optional.length;

      shoppingList.estimated_cost = this.calculateTotalCost(shoppingList);

      // Add purchase links
      shoppingList.purchase_options = await this.getPurchaseOptions(shoppingList);

      return shoppingList;

    } catch (error) {
      Logger.error('Generate shopping list error', { error: error.message });
      throw error;
    }
  }

  /**
   * Compare beauty routines
   */
  async compareRoutines(userId, routineIds) {
    try {
      const routines = await Promise.all(
        routineIds.map(id => this.getRoutineDetails(id))
      );

      // Use existing compare functionality
      const comparison = await searchService.compareProducts(
        routines.map(r => r.products).flat()
      );

      // Add beauty-specific comparison
      const beautyComparison = {
        ...comparison,
        routine_analysis: {
          time_required: routines.map(r => this.calculateRoutineTime(r)),
          concern_coverage: routines.map(r => this.analyzeConcernCoverage(r)),
          ingredient_overlap: this.findIngredientOverlap(routines),
          estimated_results: routines.map(r => r.expected_results)
        }
      };

      return beautyComparison;

    } catch (error) {
      Logger.error('Compare routines error', { error: error.message });
      throw error;
    }
  }

  /**
   * Track product performance
   */
  async trackProductPerformance(userId, productId, feedback) {
    try {
      // Update recommendation with feedback
      const { error: updateError } = await supabase
        .from('product_recommendations')
        .update({
          user_rating: feedback.rating,
          user_feedback: feedback.comments,
          marked_effective: feedback.effective,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (updateError) throw updateError;

      // Track in activity log
      await this.logProductActivity(userId, productId, feedback);

      // Update product effectiveness scores
      await this.updateProductEffectiveness(productId, feedback);

      // Trigger routine optimization if needed
      if (feedback.rating <= 2 || !feedback.effective) {
        await this.suggestAlternatives(userId, productId);
      }

      return { success: true };

    } catch (error) {
      Logger.error('Track product performance error', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async getBeautyProfile(userId) {
    const { data } = await supabase
      .from('beauty_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data;
  }

  async getLatestAnalysis(userId) {
    const { data } = await supabase
      .from('photo_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  }

  async getActiveRoutine(userId) {
    const { data: recommendations } = await supabase
      .from('product_recommendations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: tracking } = await supabase
      .from('routine_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false });

    return {
      products: recommendations,
      adherence_rate: this.calculateAdherenceRate(tracking)
    };
  }

  extractProductPreferences(profile, routine) {
    return {
      brands: profile?.favorite_brands || [],
      budget: profile?.budget_range || 'mid_range',
      ingredients_avoid: profile?.known_allergies || [],
      textures: this.inferTexturePreferences(profile?.skin_type),
      routine_complexity: routine?.products?.length > 5 ? 'comprehensive' : 'minimal'
    };
  }

  enhanceSearchQuery(query, context) {
    const concerns = context.concerns.join(' ');
    const skinType = context.skin_type;
    
    return `${query} for ${skinType} skin ${concerns}`.trim();
  }

  async rankByBeautyProfile(products, context) {
    // Implement beauty-specific ranking logic
    return products.map(product => ({
      ...product,
      beauty_match_score: this.calculateBeautyMatchScore(product, context),
      recommended_for_concerns: this.matchProductToConcerns(product, context.concerns)
    })).sort((a, b) => b.beauty_match_score - a.beauty_match_score);
  }

  calculateBeautyMatchScore(product, context) {
    let score = product.relevance_score || 0.5;
    
    // Boost score for matching skin type
    if (product.skin_hair_type?.includes(context.skin_type)) {
      score += 0.2;
    }
    
    // Boost for addressing concerns
    const concernMatches = context.concerns.filter(concern =>
      product.benefits_extracted?.toLowerCase().includes(concern)
    ).length;
    score += concernMatches * 0.1;
    
    // Penalty for allergens
    const hasAllergen = context.allergens.some(allergen =>
      product.ingredients_extracted?.toLowerCase().includes(allergen)
    );
    if (hasAllergen) score -= 0.3;
    
    return Math.max(0, Math.min(1, score));
  }

  async getBeautySearchContext(userId) {
    const profile = await this.getBeautyProfile(userId);
    const analysis = await this.getLatestAnalysis(userId);
    
    return {
      skin_type: profile?.skin_type || 'normal',
      concerns: [
        ...(profile?.primary_skin_concerns || []),
        ...(analysis?.skin_concerns?.map(c => c.type) || [])
      ],
      allergens: profile?.known_allergies || [],
      budget: profile?.budget_range || 'mid_range'
    };
  }

  async getComprehensiveBeautyData(userId) {
    const [profile, analysis, routine, progress, feedback] = await Promise.all([
      this.getBeautyProfile(userId),
      this.getLatestAnalysis(userId),
      this.getActiveRoutine(userId),
      this.getProgressSummary(userId),
      this.getProductFeedback(userId)
    ]);

    return {
      profile,
      latest_analysis: analysis,
      active_routine: routine,
      progress_summary: progress,
      product_feedback: feedback
    };
  }

  async getProgressSummary(userId) {
    const { data } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: false })
      .limit(12); // Last 12 weeks

    return {
      entries: data,
      trend: this.calculateProgressTrend(data)
    };
  }

  async getProductFeedback(userId) {
    const { data } = await supabase
      .from('product_recommendations')
      .select('product_id, user_rating, marked_effective')
      .eq('user_id', userId)
      .not('user_rating', 'is', null);

    return data;
  }

  calculateAdherenceRate(trackingData) {
    if (!trackingData || trackingData.length === 0) return 0;
    
    const completed = trackingData.filter(d => 
      d.morning_completed || d.evening_completed
    ).length;
    
    return Math.round((completed / trackingData.length) * 100);
  }

  calculateProgressTrend(progressData) {
    if (progressData.length < 2) return 'insufficient_data';
    
    const scores = progressData.map(p => p.skin_score).filter(s => s);
    const firstScore = scores[scores.length - 1];
    const lastScore = scores[0];
    
    const change = ((lastScore - firstScore) / firstScore) * 100;
    
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }
}

module.exports = new BeautyIntegrationService();