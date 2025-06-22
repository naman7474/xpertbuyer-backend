const supabase = require('../config/database');
const Logger = require('../utils/logger');

class AIAnalysisCacheService {
  constructor() {
    this.defaultTTL = {
      'skin_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days
      'hair_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days
      'lifestyle_analysis': 30 * 24 * 60 * 60 * 1000, // 30 days
      'product_recommendations': 24 * 60 * 60 * 1000, // 1 day
      'default': 24 * 60 * 60 * 1000 // 1 day
    };
  }

  /**
   * Main method to get cached analysis or generate new one
   */
  async getOrGenerate(userId, analysisType, profileData, generateFunction) {
    try {
      const cacheKey = this.generateCacheKey(userId, analysisType, profileData);
      
      Logger.debug(`Checking cache for user ${userId}, analysis type: ${analysisType}`);
      
      // Check cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached && !this.isExpired(cached)) {
        Logger.debug(`Cache hit for ${analysisType} analysis`);
        await this.updateCacheAccess(cached.id);
        return {
          fromCache: true,
          data: cached.analysis_result,
          cacheInfo: {
            cachedAt: cached.created_at,
            expiresAt: cached.expires_at,
            accessCount: cached.access_count + 1
          }
        };
      }
      
      Logger.debug(`Cache miss for ${analysisType} analysis - generating new analysis`);
      
      // Generate new analysis
      const analysis = await generateFunction();
      
      // Save to cache
      await this.saveToCache(cacheKey, userId, analysisType, profileData, analysis);
      
      return {
        fromCache: false,
        data: analysis,
        cacheInfo: {
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + this.getTTL(analysisType)),
          accessCount: 1
        }
      };
      
    } catch (error) {
      Logger.error('Cache service error', { error: error.message, userId, analysisType });
      // If cache fails, still try to generate analysis
      const analysis = await generateFunction();
      return {
        fromCache: false,
        data: analysis,
        cacheInfo: null,
        error: error.message
      };
    }
  }

  /**
   * Generate cache key based on user and profile data
   */
  generateCacheKey(userId, analysisType, profileData) {
    const crypto = require('crypto');
    const dataString = JSON.stringify({
      userId,
      analysisType,
      profileData: profileData || {}
    });
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Get analysis from cache
   */
  async getFromCache(cacheKey) {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (error) {
        // If table doesn't exist, return null gracefully
        if (error.message.includes('does not exist')) {
          Logger.debug('Cache table does not exist, skipping cache lookup');
          return null;
        }
        Logger.debug('Cache retrieval error', { error: error.message });
        return null;
      }
      return data;
    } catch (error) {
      Logger.error('Cache get error', { error: error.message });
      return null;
    }
  }

  /**
   * Save analysis to cache
   */
  async saveToCache(cacheKey, userId, analysisType, profileData, analysis) {
    try {
      const expiresAt = new Date(Date.now() + this.getTTL(analysisType));
      
      const { error } = await supabase
        .from('ai_analysis_cache')
        .upsert({
          cache_key: cacheKey,
          user_id: userId,
          analysis_type: analysisType,
          profile_data: profileData,
          analysis_result: analysis,
          expires_at: expiresAt.toISOString(),
          access_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        // If table doesn't exist, just log and continue without caching
        if (error.message.includes('does not exist')) {
          Logger.debug('Cache table does not exist, skipping cache save');
          return;
        }
        Logger.error('Cache save error', { error: error.message });
      } else {
        Logger.debug(`Cached ${analysisType} analysis for user ${userId}`);
      }
    } catch (error) {
      Logger.error('Cache save error', { error: error.message });
    }
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(cacheEntry) {
    return new Date() > new Date(cacheEntry.expires_at);
  }

  /**
   * Get TTL for analysis type
   */
  getTTL(analysisType) {
    return this.defaultTTL[analysisType] || this.defaultTTL.default;
  }

  /**
   * Update cache access count
   */
  async updateCacheAccess(cacheId) {
    try {
      await supabase
        .from('ai_analysis_cache')
        .update({
          access_count: supabase.raw('access_count + 1'),
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', cacheId);
    } catch (error) {
      Logger.error('Cache access update error', { error: error.message });
    }
  }

  /**
   * Invalidate cache for a user and analysis type
   */
  async invalidateCache(userId, analysisType = null) {
    try {
      let query = supabase
        .from('ai_analysis_cache')
        .delete()
        .eq('user_id', userId);

      if (analysisType) {
        query = query.eq('analysis_type', analysisType);
      }

      const { error } = await query;
      
      if (error) {
        Logger.error('Cache invalidation error', { error: error.message });
      } else {
        Logger.debug(`Invalidated cache for user ${userId}${analysisType ? ` (${analysisType})` : ''}`);
      }
    } catch (error) {
      Logger.error('Cache invalidation error', { error: error.message });
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const { error } = await supabase
        .from('ai_analysis_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        Logger.error('Cache cleanup error', { error: error.message });
      } else {
        Logger.debug('Cleaned up expired cache entries');
      }
    } catch (error) {
      Logger.error('Cache cleanup error', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_cache')
        .select('analysis_type, expires_at, access_count');

      if (error) {
        // If table doesn't exist, return empty stats
        if (error.message.includes('does not exist')) {
          Logger.debug('Cache table does not exist, returning empty stats');
          return {
            total: 0,
            active: 0,
            expired: 0,
            totalAccesses: 0,
            byType: {},
            tableExists: false
          };
        }
        Logger.error('Cache stats error', { error: error.message });
        return null;
      }

      const now = new Date();
      const stats = {
        total: data.length,
        active: data.filter(item => new Date(item.expires_at) > now).length,
        expired: data.filter(item => new Date(item.expires_at) <= now).length,
        totalAccesses: data.reduce((sum, item) => sum + (item.access_count || 0), 0),
        byType: {},
        tableExists: true
      };

      // Group by analysis type
      data.forEach(item => {
        if (!stats.byType[item.analysis_type]) {
          stats.byType[item.analysis_type] = { count: 0, accesses: 0 };
        }
        stats.byType[item.analysis_type].count++;
        stats.byType[item.analysis_type].accesses += item.access_count || 0;
      });

      return stats;
    } catch (error) {
      Logger.error('Cache stats error', { error: error.message });
      return null;
    }
  }

  /**
   * Initialize cache table (if needed)
   */
  async initializeCacheTable() {
    try {
      // This would typically be handled by database migrations
      Logger.debug('Cache table initialization would be handled by database migrations');
    } catch (error) {
      Logger.error('Cache table initialization error', { error: error.message });
    }
  }
}

module.exports = AIAnalysisCacheService; 