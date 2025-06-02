const crypto = require('crypto');
const supabase = require('../config/database');

class AIAnalysisCacheService {
  constructor() {
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.cacheTTLs = {
      'skin_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days for skin analysis
      'hair_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days for hair analysis
      'lifestyle_analysis': 3 * 24 * 60 * 60 * 1000, // 3 days for lifestyle
      'health_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days for health
      'makeup_analysis': 7 * 24 * 60 * 60 * 1000, // 7 days for makeup
      'comprehensive_analysis': 12 * 60 * 60 * 1000, // 12 hours for comprehensive
    };
  }

  /**
   * Main method to get cached analysis or generate new one
   */
  async getOrGenerate(userId, analysisType, profileData, generateFunction) {
    try {
      const cacheKey = this.generateCacheKey(userId, analysisType, profileData);
      
      console.log(`🔍 Checking cache for user ${userId}, analysis type: ${analysisType}`);
      
      // Check cache first
      const cached = await this.getFromCache(cacheKey);
      if (cached && !this.isExpired(cached)) {
        console.log(`✅ Cache hit for ${analysisType} analysis`);
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
      
      console.log(`❌ Cache miss for ${analysisType} analysis - generating new analysis`);
      
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
      console.error('Cache service error:', error);
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
   * Generate a unique cache key based on user, analysis type, and profile data
   */
  generateCacheKey(userId, analysisType, profileData) {
    const dataHash = this.hashData(profileData);
    return `${userId}:${analysisType}:${dataHash}`;
  }

  /**
   * Create a hash of the profile data for cache key generation
   */
  hashData(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(jsonString).digest('hex');
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

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Cache retrieval error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Save analysis result to cache
   */
  async saveToCache(cacheKey, userId, analysisType, profileData, analysisResult) {
    try {
      const ttl = this.getTTL(analysisType);
      const expiresAt = new Date(Date.now() + ttl);

      const cacheData = {
        cache_key: cacheKey,
        user_id: userId,
        analysis_type: analysisType,
        profile_data_hash: this.hashData(profileData),
        analysis_result: analysisResult,
        expires_at: expiresAt.toISOString(),
        access_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Upsert the cache entry
      const { error } = await supabase
        .from('ai_analysis_cache')
        .upsert(cacheData, { 
          onConflict: 'cache_key',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Cache save error:', error);
      } else {
        console.log(`💾 Cached ${analysisType} analysis for user ${userId}`);
      }
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(cacheEntry) {
    if (!cacheEntry || !cacheEntry.expires_at) {
      return true;
    }
    
    const expiresAt = new Date(cacheEntry.expires_at);
    const now = new Date();
    
    return now > expiresAt;
  }

  /**
   * Update cache access count and timestamp
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
      console.error('Cache access update error:', error);
    }
  }

  /**
   * Get TTL for specific analysis type
   */
  getTTL(analysisType) {
    return this.cacheTTLs[analysisType] || this.defaultTTL;
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
        console.error('Cache invalidation error:', error);
      } else {
        console.log(`🗑️ Invalidated cache for user ${userId}${analysisType ? ` (${analysisType})` : ''}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
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
        console.error('Cache cleanup error:', error);
      } else {
        console.log('🧹 Cleaned up expired cache entries');
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(userId = null) {
    try {
      let query = supabase
        .from('ai_analysis_cache')
        .select('analysis_type, access_count, created_at, expires_at');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Cache stats error:', error);
        return null;
      }

      const now = new Date();
      const stats = {
        total: data.length,
        active: data.filter(entry => new Date(entry.expires_at) > now).length,
        expired: data.filter(entry => new Date(entry.expires_at) <= now).length,
        totalAccesses: data.reduce((sum, entry) => sum + entry.access_count, 0),
        byType: {}
      };

      // Group by analysis type
      data.forEach(entry => {
        if (!stats.byType[entry.analysis_type]) {
          stats.byType[entry.analysis_type] = {
            count: 0,
            accesses: 0,
            active: 0,
            expired: 0
          };
        }
        
        stats.byType[entry.analysis_type].count++;
        stats.byType[entry.analysis_type].accesses += entry.access_count;
        
        if (new Date(entry.expires_at) > now) {
          stats.byType[entry.analysis_type].active++;
        } else {
          stats.byType[entry.analysis_type].expired++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Initialize cache table if it doesn't exist
   */
  async initializeCacheTable() {
    try {
      // This would typically be handled by migrations, but including for completeness
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ai_analysis_cache (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID NOT NULL,
          analysis_type VARCHAR(100) NOT NULL,
          profile_data_hash VARCHAR(32) NOT NULL,
          analysis_result JSONB NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          access_count INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_ai_cache_user_type ON ai_analysis_cache(user_id, analysis_type);
        CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_analysis_cache(expires_at);
        CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_analysis_cache(cache_key);
      `;

      console.log('Cache table initialization would be handled by database migrations');
      return true;
    } catch (error) {
      console.error('Cache table initialization error:', error);
      return false;
    }
  }
}

module.exports = AIAnalysisCacheService; 