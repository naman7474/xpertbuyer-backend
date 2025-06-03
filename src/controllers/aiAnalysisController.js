const aiAnalysisService = require('../services/aiAnalysisService');
const supabase = require('../config/database');
const CacheCleanupService = require('../utils/cacheCleanupService');
const Logger = require('../utils/logger');

const aiAnalysisController = {
  /**
   * Trigger comprehensive AI analysis for user
   */
  async triggerComprehensiveAnalysis(req, res) {
    try {
      const userId = req.user.id;
      
      Logger.info(`Triggering comprehensive AI analysis for user ${userId}`);
      
      const analysisResult = await aiAnalysisService.analyzeProfileData(
        userId, 
        'comprehensive', 
        {}, 
        'manual_comprehensive_analysis'
      );
      
      res.json({
        success: true,
        message: 'Comprehensive AI analysis completed',
        data: analysisResult
      });
      
    } catch (error) {
      Logger.error('Comprehensive analysis error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to perform comprehensive analysis',
        error: error.message
      });
    }
  },

  /**
   * Trigger specific category analysis
   */
  async triggerCategoryAnalysis(req, res) {
    try {
      const userId = req.user.id;
      const { category } = req.params;
      const profileData = req.body || {};
      
      const validCategories = ['skin', 'hair', 'lifestyle', 'health', 'makeup'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }
      
      Logger.info(`Triggering ${category} AI analysis for user ${userId}`);
      
      const analysisResult = await aiAnalysisService.analyzeProfileData(
        userId, 
        category, 
        profileData, 
        `manual_${category}_analysis`
      );
      
      res.json({
        success: true,
        message: `${category} AI analysis completed`,
        data: analysisResult
      });
      
    } catch (error) {
      Logger.error(`${req.params.category} analysis error`, { error: error.message });
      res.status(500).json({
        success: false,
        message: `Failed to perform ${req.params.category} analysis`,
        error: error.message
      });
    }
  },

  /**
   * Get user's AI analysis history
   */
  async getAnalysisHistory(req, res) {
    try {
      const userId = req.user.id;
      const { category, limit = 10 } = req.query;
      
      const history = await aiAnalysisService.getUserAnalysisHistory(
        userId, 
        category, 
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: {
          history,
          total: history.length,
          category: category || 'all'
        }
      });
      
    } catch (error) {
      Logger.error('Get analysis history error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis history',
        error: error.message
      });
    }
  },

  /**
   * Get active AI recommendations
   */
  async getActiveRecommendations(req, res) {
    try {
      const userId = req.user.id;
      const { category } = req.query;
      
      const recommendations = await aiAnalysisService.getActiveRecommendations(
        userId, 
        category
      );
      
      // Group recommendations by category for better organization
      const groupedRecommendations = recommendations.reduce((acc, rec) => {
        if (!acc[rec.category]) {
          acc[rec.category] = [];
        }
        acc[rec.category].push(rec);
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: {
          recommendations: groupedRecommendations,
          total: recommendations.length,
          categories: Object.keys(groupedRecommendations)
        }
      });
      
    } catch (error) {
      Logger.error('Get recommendations error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recommendations',
        error: error.message
      });
    }
  },

  /**
   * Get specific analysis result by ID
   */
  async getAnalysisResult(req, res) {
    try {
      const userId = req.user.id;
      const { analysisId } = req.params;
      
      const { data: analysis, error } = await supabase
        .from('ai_analysis_results')
        .select(`
          *,
          ai_recommendations(*)
        `)
        .eq('id', analysisId)
        .eq('user_id', userId)
        .single();
      
      if (error || !analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis result not found'
        });
      }
      
      res.json({
        success: true,
        data: analysis
      });
      
    } catch (error) {
      Logger.error('Get analysis result error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis result',
        error: error.message
      });
    }
  },

  /**
   * Get analysis dashboard/summary
   */
  async getAnalysisDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      // Get recent analyses
      const recentAnalyses = await aiAnalysisService.getUserAnalysisHistory(userId, null, 5);
      
      // Get active recommendations
      const activeRecommendations = await aiAnalysisService.getActiveRecommendations(userId);
      
      // Get analysis sessions summary
      const { data: sessions } = await supabase
        .from('ai_analysis_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Calculate statistics
      const stats = {
        total_analyses: recentAnalyses.length,
        total_recommendations: activeRecommendations.length,
        categories_analyzed: [...new Set(recentAnalyses.map(a => a.analysis_type))],
        last_analysis: recentAnalyses[0]?.created_at || null,
        average_confidence: recentAnalyses.length > 0 ? 
          recentAnalyses.reduce((avg, a) => avg + (a.confidence_score || 0), 0) / recentAnalyses.length : 0
      };
      
      res.json({
        success: true,
        data: {
          statistics: stats,
          recent_analyses: recentAnalyses,
          active_recommendations: activeRecommendations,
          recent_sessions: sessions || []
        }
      });
      
    } catch (error) {
      Logger.error('Get analysis dashboard error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis dashboard',
        error: error.message
      });
    }
  },

  /**
   * Mark recommendation as used/completed
   */
  async markRecommendationCompleted(req, res) {
    try {
      const userId = req.user.id;
      const { recommendationId } = req.params;
      
      const { data, error } = await supabase
        .from('ai_recommendations')
        .update({ 
          is_active: false,
          metadata: { 
            completed_at: new Date().toISOString(),
            completed_by_user: true 
          }
        })
        .eq('id', recommendationId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        return res.status(404).json({
          success: false,
          message: 'Recommendation not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Recommendation marked as completed',
        data
      });
      
    } catch (error) {
      Logger.error('Mark recommendation completed error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to update recommendation',
        error: error.message
      });
    }
  },

  /**
   * Get AI analysis insights summary
   */
  async getInsightsSummary(req, res) {
    try {
      const userId = req.user.id;
      const { category } = req.query;
      
      let query = supabase
        .from('ai_analysis_results')
        .select('analysis_type, insights, confidence_score, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('analysis_type', category);
      }
      
      const { data: analyses, error } = await query;
      
      if (error) throw error;
      
      // Process insights
      const processedInsights = analyses.reduce((acc, analysis) => {
        const categoryInsights = acc[analysis.analysis_type] || [];
        const insights = Array.isArray(analysis.insights) ? analysis.insights : [];
        
        categoryInsights.push({
          insights,
          confidence: analysis.confidence_score,
          date: analysis.created_at
        });
        
        acc[analysis.analysis_type] = categoryInsights;
        return acc;
      }, {});
      
      res.json({
        success: true,
        data: {
          insights_by_category: processedInsights,
          total_analyses: analyses.length,
          categories: Object.keys(processedInsights)
        }
      });
      
    } catch (error) {
      Logger.error('Get insights summary error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve insights summary',
        error: error.message
      });
    }
  },

  /**
   * Get cache statistics for the user
   */
  async getCacheStatistics(req, res) {
    try {
      const userId = req.user.id;
      const cacheCleanupService = new CacheCleanupService();
      
      // Get user-specific cache stats
      const userStats = await aiAnalysisService.getCacheStatistics(userId);
      
      // Get overall cache health
      const healthCheck = await cacheCleanupService.healthCheck();
      
      res.json({
        success: true,
        data: {
          user_cache: userStats,
          system_health: healthCheck,
          cache_info: {
            description: 'AI analysis results are cached to improve performance',
            ttl_info: {
              skin_analysis: '7 days',
              hair_analysis: '7 days', 
              lifestyle_analysis: '3 days',
              health_analysis: '7 days',
              makeup_analysis: '7 days',
              comprehensive_analysis: '12 hours'
            }
          }
        }
      });
      
    } catch (error) {
      Logger.error('Get cache statistics error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cache statistics',
        error: error.message
      });
    }
  },

  /**
   * Invalidate all cache for the user
   */
  async invalidateUserCache(req, res) {
    try {
      const userId = req.user.id;
      
      await aiAnalysisService.invalidateUserAnalysisCache(userId);
      
      res.json({
        success: true,
        message: 'User cache invalidated successfully',
        data: {
          user_id: userId,
          invalidated_at: new Date().toISOString(),
          note: 'All cached AI analysis results for this user have been cleared'
        }
      });
      
    } catch (error) {
      Logger.error('Invalidate user cache error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate user cache',
        error: error.message
      });
    }
  },

  /**
   * Invalidate cache for specific analysis type
   */
  async invalidateUserCacheByType(req, res) {
    try {
      const userId = req.user.id;
      const { analysisType } = req.params;
      
      const validTypes = ['skin_analysis', 'hair_analysis', 'lifestyle_analysis', 'health_analysis', 'makeup_analysis', 'comprehensive_analysis'];
      if (!validTypes.includes(analysisType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid analysis type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      
      await aiAnalysisService.invalidateUserAnalysisCache(userId, analysisType);
      
      res.json({
        success: true,
        message: `${analysisType} cache invalidated successfully`,
        data: {
          user_id: userId,
          analysis_type: analysisType,
          invalidated_at: new Date().toISOString(),
          note: `Cached ${analysisType} results for this user have been cleared`
        }
      });
      
    } catch (error) {
      Logger.error('Invalidate user cache by type error', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to invalidate user cache by type',
        error: error.message
      });
    }
  }
};

module.exports = aiAnalysisController; 