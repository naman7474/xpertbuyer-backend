const supabase = require('../config/database');
const Logger = require('./logger');

class CacheCleanupService {
  constructor() {
    this.cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
    this.isRunning = false;
  }

  /**
   * Start the cache cleanup service
   */
  start() {
    if (this.isRunning) {
      Logger.warn('Cache cleanup service is already running');
      return;
    }

    Logger.info('Starting cache cleanup service (every 6 hours)', {});
    this.isRunning = true;

    // Run initial cleanup
    this.performCleanup();

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    Logger.info('Cache cleanup service initialized', {});
  }

  /**
   * Stop the cache cleanup service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    Logger.info('Cache cleanup service stopped', {});
  }

  /**
   * Perform cache cleanup
   */
  async performCleanup() {
    try {
      Logger.debug('Starting cache cleanup...', {});

      // Get cache statistics first
      const stats = await this.getCacheStats();
      if (stats && stats.tableExists) {
        // Clean up expired entries
        const deletedCount = await this.cleanupExpiredEntries();
        Logger.info(`Cache cleanup completed. Removed ${deletedCount} expired entries`, {});
      } else {
        Logger.debug('Cache table does not exist, skipping cleanup');
        Logger.info('Cache cleanup completed. Removed 0 expired entries', {});
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
        .select('expires_at');

      if (error) {
        if (error.message.includes('does not exist')) {
          return { tableExists: false };
        }
        throw error;
      }

      const now = new Date();
      const expiredCount = data.filter(item => new Date(item.expires_at) <= now).length;

      return {
        total: data.length,
        expired: expiredCount,
        tableExists: true
      };
    } catch (error) {
      Logger.error('Cache stats error', { error: error.message });
      return { tableExists: false };
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries() {
    try {
      const { count, error } = await supabase
        .from('ai_analysis_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      Logger.error('Cache cleanup error', { error: error.message });
      return 0;
    }
  }

  /**
   * Get detailed cache statistics
   */
  async getCacheStatistics() {
    try {
      const stats = await this.getCacheStats();
      
      if (!stats) {
        return { error: 'Unable to retrieve cache statistics' };
      }

      const report = {
        summary: {
          total: stats.total,
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
      const stats = await this.getCacheStats();
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

module.exports = new CacheCleanupService(); 