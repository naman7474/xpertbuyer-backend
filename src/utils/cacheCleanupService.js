const AIAnalysisCacheService = require('../services/aiAnalysisCacheService');

class CacheCleanupService {
  constructor() {
    this.cacheService = new AIAnalysisCacheService();
    this.isRunning = false;
  }

  /**
   * Start periodic cache cleanup
   */
  startPeriodicCleanup(intervalHours = 6) {
    if (this.isRunning) {
      console.log('🔄 Cache cleanup service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds

    console.log(`🚀 Starting cache cleanup service (every ${intervalHours} hours)`);
    
    // Run initial cleanup
    this.performCleanup();
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMs);
  }

  /**
   * Stop periodic cache cleanup
   */
  stopPeriodicCleanup() {
    if (!this.isRunning) {
      console.log('🛑 Cache cleanup service is not running');
      return;
    }

    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    console.log('🛑 Cache cleanup service stopped');
  }

  /**
   * Perform cache cleanup
   */
  async performCleanup() {
    try {
      console.log('🧹 Starting cache cleanup...');
      
      // Get statistics before cleanup
      const statsBefore = await this.cacheService.getCacheStats();
      
      // Cleanup expired entries
      await this.cacheService.cleanupExpiredCache();
      
      // Get statistics after cleanup
      const statsAfter = await this.cacheService.getCacheStats();
      
      const cleaned = statsBefore ? statsBefore.expired : 0;
      console.log(`✅ Cache cleanup completed. Removed ${cleaned} expired entries`);
      
      // Log current cache status
      if (statsAfter) {
        console.log(`📊 Cache status: ${statsAfter.active} active, ${statsAfter.total} total entries`);
      }
      
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
  }

  /**
   * Get detailed cache statistics
   */
  async getCacheStatistics() {
    try {
      const stats = await this.cacheService.getCacheStats();
      
      if (!stats) {
        return { error: 'Unable to retrieve cache statistics' };
      }

      const report = {
        summary: {
          total: stats.total,
          active: stats.active,
          expired: stats.expired,
          totalAccesses: stats.totalAccesses,
          cacheHitRate: stats.totalAccesses > 0 ? ((stats.totalAccesses - stats.total) / stats.totalAccesses * 100).toFixed(2) + '%' : '0%'
        },
        byType: stats.byType,
        performance: {
          averageAccessesPerEntry: stats.total > 0 ? (stats.totalAccesses / stats.total).toFixed(2) : '0',
          expiredPercentage: stats.total > 0 ? ((stats.expired / stats.total) * 100).toFixed(2) + '%' : '0%'
        },
        serviceStatus: {
          cleanupRunning: this.isRunning,
          lastCleanup: new Date().toISOString()
        }
      };

      return report;
    } catch (error) {
      console.error('Cache statistics error:', error);
      return { error: error.message };
    }
  }

  /**
   * Force cache cleanup for a specific user
   */
  async cleanupUserCache(userId, analysisType = null) {
    try {
      console.log(`🗑️ Cleaning up cache for user ${userId}${analysisType ? ` (${analysisType})` : ''}`);
      await this.cacheService.invalidateCache(userId, analysisType);
      console.log('✅ User cache cleanup completed');
    } catch (error) {
      console.error('User cache cleanup error:', error);
      throw error;
    }
  }

  /**
   * Warm up cache for critical users (optional optimization)
   */
  async warmupCache(userIds = []) {
    console.log(`🔥 Starting cache warmup for ${userIds.length} users...`);
    
    // This would trigger analysis for high-priority users
    // Implementation depends on business logic
    console.log('Cache warmup completed');
  }

  /**
   * Health check for cache service
   */
  async healthCheck() {
    try {
      const stats = await this.cacheService.getCacheStats();
      const isHealthy = stats !== null;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        cleanupServiceRunning: this.isRunning,
        cacheStats: stats
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = CacheCleanupService; 