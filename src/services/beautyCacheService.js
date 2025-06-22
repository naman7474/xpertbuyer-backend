// src/services/beautyCacheService.js
const redis = require('redis');
const Logger = require('../utils/logger');
const crypto = require('crypto');

class BeautyCacheService {
  constructor() {
    this.client = null;
    this.defaultTTL = {
      userProfile: 3600,        // 1 hour
      skinAnalysis: 86400,      // 24 hours
      recommendations: 43200,    // 12 hours
      faceModel: 604800,        // 7 days
      progressData: 7200,       // 2 hours
      routineTracking: 1800     // 30 minutes
    };
    
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
      });

      this.client.on('error', (err) => {
        Logger.error('Redis Client Error', { error: err.message });
      });

      this.client.on('connect', () => {
        Logger.info('Redis Client Connected');
      });

      await this.client.connect();
    } catch (error) {
      Logger.error('Redis initialization failed', { error: error.message });
      // Fallback to in-memory cache if Redis fails
      this.useInMemoryCache();
    }
  }

  /**
   * Fallback to in-memory cache
   */
  useInMemoryCache() {
    this.inMemoryCache = new Map();
    this.client = {
      get: async (key) => {
        const item = this.inMemoryCache.get(key);
        if (item && item.expiry > Date.now()) {
          return JSON.stringify(item.value);
        }
        this.inMemoryCache.delete(key);
        return null;
      },
      set: async (key, value, options) => {
        const ttl = options?.EX || 3600;
        this.inMemoryCache.set(key, {
          value: JSON.parse(value),
          expiry: Date.now() + (ttl * 1000)
        });
        return 'OK';
      },
      del: async (key) => {
        this.inMemoryCache.delete(key);
        return 1;
      },
      keys: async (pattern) => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(this.inMemoryCache.keys()).filter(key => regex.test(key));
      }
    };
  }

  /**
   * Generate cache key
   */
  generateKey(type, identifier, params = {}) {
    const baseKey = `beauty:${type}:${identifier}`;
    
    if (Object.keys(params).length === 0) {
      return baseKey;
    }

    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join(':');

    const hash = crypto
      .createHash('md5')
      .update(sortedParams)
      .digest('hex')
      .substring(0, 8);

    return `${baseKey}:${hash}`;
  }

  /**
   * Cache user beauty profile
   */
  async cacheUserProfile(userId, profileData) {
    try {
      const key = this.generateKey('profile', userId);
      await this.set(key, profileData, this.defaultTTL.userProfile);
      
      // Cache individual profile sections for granular access
      const sections = ['skin', 'hair', 'lifestyle', 'health', 'makeup'];
      for (const section of sections) {
        if (profileData[section]) {
          const sectionKey = this.generateKey('profile', userId, { section });
          await this.set(sectionKey, profileData[section], this.defaultTTL.userProfile);
        }
      }

      Logger.debug('Cached user beauty profile', { userId });
    } catch (error) {
      Logger.error('Cache user profile error', { error: error.message });
    }
  }

  /**
   * Get cached user profile
   */
  async getCachedUserProfile(userId, section = null) {
    try {
      const key = section 
        ? this.generateKey('profile', userId, { section })
        : this.generateKey('profile', userId);
      
      return await this.get(key);
    } catch (error) {
      Logger.error('Get cached profile error', { error: error.message });
      return null;
    }
  }

  /**
   * Cache skin analysis results
   */
  async cacheSkinAnalysis(photoId, analysisData) {
    try {
      const key = this.generateKey('analysis', photoId);
      await this.set(key, analysisData, this.defaultTTL.skinAnalysis);
      
      // Also cache by user for quick access
      if (analysisData.user_id) {
        const userKey = this.generateKey('analysis', analysisData.user_id, { latest: true });
        await this.set(userKey, analysisData, this.defaultTTL.skinAnalysis);
      }

      Logger.debug('Cached skin analysis', { photoId });
    } catch (error) {
      Logger.error('Cache skin analysis error', { error: error.message });
    }
  }

  /**
   * Cache beauty recommendations
   */
  async cacheRecommendations(userId, recommendations, context = {}) {
    try {
      const key = this.generateKey('recommendations', userId, context);
      await this.set(key, recommendations, this.defaultTTL.recommendations);
      
      // Cache individual product recommendations for quick lookup
      if (recommendations.routine) {
        for (const timeOfDay of ['morning', 'evening']) {
          const routine = recommendations.routine[timeOfDay];
          if (routine) {
            const routineKey = this.generateKey('routine', userId, { time: timeOfDay });
            await this.set(routineKey, routine, this.defaultTTL.recommendations);
          }
        }
      }

      Logger.debug('Cached beauty recommendations', { userId });
    } catch (error) {
      Logger.error('Cache recommendations error', { error: error.message });
    }
  }

  /**
   * Cache 3D face model data
   */
  async cacheFaceModel(userId, modelData) {
    try {
      const key = this.generateKey('facemodel', userId);
      
      // Store model metadata in cache
      const metadata = {
        model_url: modelData.model_url,
        landmarks: modelData.landmarks,
        generated_at: new Date().toISOString(),
        face_zones: modelData.face_zones
      };

      await this.set(key, metadata, this.defaultTTL.faceModel);
      
      Logger.debug('Cached face model data', { userId });
    } catch (error) {
      Logger.error('Cache face model error', { error: error.message });
    }
  }

  /**
   * Cache progress data with smart invalidation
   */
  async cacheProgressData(userId, weekNumber, progressData) {
    try {
      // Cache specific week
      const weekKey = this.generateKey('progress', userId, { week: weekNumber });
      await this.set(weekKey, progressData, this.defaultTTL.progressData);
      
      // Update timeline cache
      await this.updateTimelineCache(userId, weekNumber, progressData);
      
      Logger.debug('Cached progress data', { userId, weekNumber });
    } catch (error) {
      Logger.error('Cache progress data error', { error: error.message });
    }
  }

  /**
   * Update timeline cache intelligently
   */
  async updateTimelineCache(userId, weekNumber, newData) {
    const timelineKey = this.generateKey('timeline', userId);
    const existingTimeline = await this.get(timelineKey) || { weeks: {} };
    
    existingTimeline.weeks[weekNumber] = {
      skin_score: newData.skin_score,
      date: newData.created_at,
      improvements: newData.concern_improvements
    };
    
    // Keep only last 12 weeks in cache
    const sortedWeeks = Object.keys(existingTimeline.weeks)
      .map(Number)
      .sort((a, b) => b - a)
      .slice(0, 12);
    
    const trimmedTimeline = {
      weeks: sortedWeeks.reduce((acc, week) => {
        acc[week] = existingTimeline.weeks[week];
        return acc;
      }, {}),
      last_updated: new Date().toISOString()
    };
    
    await this.set(timelineKey, trimmedTimeline, this.defaultTTL.progressData);
  }

  /**
   * Cache routine tracking with daily aggregation
   */
  async cacheRoutineTracking(userId, date, trackingData) {
    try {
      // Cache individual day
      const dayKey = this.generateKey('routine', userId, { date });
      await this.set(dayKey, trackingData, this.defaultTTL.routineTracking);
      
      // Update weekly summary
      await this.updateWeeklySummaryCache(userId, date, trackingData);
      
      Logger.debug('Cached routine tracking', { userId, date });
    } catch (error) {
      Logger.error('Cache routine tracking error', { error: error.message });
    }
  }

  /**
   * Update weekly summary cache
   */
  async updateWeeklySummaryCache(userId, date, dayData) {
    const weekStart = this.getWeekStart(new Date(date));
    const summaryKey = this.generateKey('routine-summary', userId, { week: weekStart });
    
    const summary = await this.get(summaryKey) || {
      total_days: 0,
      completed_days: 0,
      morning_completed: 0,
      evening_completed: 0,
      perfect_days: 0
    };
    
    // Update summary
    summary.total_days = Math.min(summary.total_days + 1, 7);
    if (dayData.morning_completed || dayData.evening_completed) {
      summary.completed_days++;
    }
    if (dayData.morning_completed) summary.morning_completed++;
    if (dayData.evening_completed) summary.evening_completed++;
    if (dayData.morning_completed && dayData.evening_completed) {
      summary.perfect_days++;
    }
    
    await this.set(summaryKey, summary, this.defaultTTL.routineTracking);
  }

  /**
   * Get week start date
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  /**
   * Invalidate user caches
   */
  async invalidateUserCache(userId, types = []) {
    try {
      const patterns = types.length > 0 
        ? types.map(type => `beauty:${type}:${userId}*`)
        : [`beauty:*:${userId}*`];

      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map(key => this.client.del(key)));
          Logger.debug('Invalidated cache keys', { count: keys.length, pattern });
        }
      }
    } catch (error) {
      Logger.error('Invalidate user cache error', { error: error.message });
    }
  }

  /**
   * Batch get multiple cache entries
   */
  async batchGet(keys) {
    try {
      const results = {};
      const promises = keys.map(async (key) => {
        const value = await this.get(key);
        if (value) {
          results[key] = value;
        }
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      Logger.error('Batch get error', { error: error.message });
      return {};
    }
  }

  /**
   * Warm up cache for user
   */
  async warmUpUserCache(userId) {
    try {
      Logger.info('Warming up cache for user', { userId });

      // Pre-fetch commonly accessed data
      const tasks = [
        this.prefetchUserProfile(userId),
        this.prefetchLatestAnalysis(userId),
        this.prefetchActiveRecommendations(userId),
        this.prefetchRecentProgress(userId)
      ];

      await Promise.all(tasks);
      
      Logger.info('Cache warm-up completed', { userId });
    } catch (error) {
      Logger.error('Cache warm-up error', { error: error.message });
    }
  }

  /**
   * Helper methods for cache operations
   */
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      Logger.error('Cache get error', { error: error.message, key });
      return null;
    }
  }

  async set(key, value, ttl) {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttl });
    } catch (error) {
      Logger.error('Cache set error', { error: error.message, key });
    }
  }

  /**
   * Pre-fetch methods for cache warming
   */
  async prefetchUserProfile(userId) {
    // Implementation would fetch from database and cache
  }

  async prefetchLatestAnalysis(userId) {
    // Implementation would fetch latest analysis and cache
  }

  async prefetchActiveRecommendations(userId) {
    // Implementation would fetch active recommendations and cache
  }

  async prefetchRecentProgress(userId) {
    // Implementation would fetch recent progress data and cache
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const info = await this.client.info('stats');
      const keyCount = await this.client.dbSize();
      
      return {
        connected: this.client.isOpen,
        keys: keyCount,
        memory: this.parseRedisInfo(info, 'used_memory_human'),
        hits: this.parseRedisInfo(info, 'keyspace_hits'),
        misses: this.parseRedisInfo(info, 'keyspace_misses'),
        hit_rate: this.calculateHitRate(info)
      };
    } catch (error) {
      Logger.error('Get cache stats error', { error: error.message });
      return { error: 'Unable to fetch cache statistics' };
    }
  }

  parseRedisInfo(info, field) {
    const match = info.match(new RegExp(`${field}:(.+)`));
    return match ? match[1].trim() : null;
  }

  calculateHitRate(info) {
    const hits = parseInt(this.parseRedisInfo(info, 'keyspace_hits') || 0);
    const misses = parseInt(this.parseRedisInfo(info, 'keyspace_misses') || 0);
    const total = hits + misses;
    return total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : '0%';
  }
}

module.exports = new BeautyCacheService();