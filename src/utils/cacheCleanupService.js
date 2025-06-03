const AIAnalysisCacheService = require('../services/aiAnalysisCacheService');
const Logger = require('./logger');

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
      Logger.info('Cache cleanup service is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds

    Logger.info(`Starting cache cleanup service (every ${intervalHours} hours)`);
    
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
      Logger.debug('Cache cleanup service is not running');
      return;
    }

    this.isRunning = false;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    Logger.info('Cache cleanup service stopped');
  }

  /**
   * Perform cache cleanup
   */
  async performCleanup() {
    try {
      Logger.debug('Starting cache cleanup...');
      
      // Get statistics before cleanup
      const statsBefore = await this.cacheService.getCacheStats();
      
      // Cleanup expired entries
      await this.cacheService.cleanupExpiredCache();
      
      // Get statistics after cleanup
      const statsAfter = await this.cacheService.getCacheStats();
      
      const cleaned = statsBefore ? statsBefore.expired : 0;
      Logger.info(`Cache cleanup completed. Removed ${cleaned} expired entries`);
      
      // Log current cache status in debug mode
      if (statsAfter) {
        Logger.debug(`Cache status: ${statsAfter.active} active, ${statsAfter.total} total entries`);
      }
      
    } catch (error) {
      Logger.error('Cache cleanup error', { error: error.message });
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
      Logger.error('Cache statistics error', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Force cache cleanup for a specific user
   */
  async cleanupUserCache(userId, analysisType = null) {
    try {
      Logger.debug(`Cleaning up cache for user ${userId}${analysisType ? ` (${analysisType})` : ''}`);
      await this.cacheService.invalidateCache(userId, analysisType);
      Logger.debug('User cache cleanup completed');
    } catch (error) {
      Logger.error('User cache cleanup error', { error: error.message, userId, analysisType });
      throw error;
    }
  }

  /**
   * Warm up cache for critical users (optional optimization)
   */
  async warmupCache(userIds = []) {
    Logger.debug(`Starting cache warmup for ${userIds.length} users...`);
    
    // This would trigger analysis for high-priority users
    // Implementation depends on business logic
    Logger.debug('Cache warmup completed');
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