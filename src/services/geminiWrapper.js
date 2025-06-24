const { GoogleGenerativeAI } = require('@google/generative-ai');
const pRetry = require('p-retry');
const crypto = require('crypto');
const supabase = require('../config/database');
const Logger = require('../utils/logger');

class GeminiWrapper {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Model instances
    this.models = {
      flash: this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
      pro: this.genAI.getGenerativeModel({ model: 'gemini-pro' }),
      vision: this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' })
    };

    // Rate limit tracking
    this.rateLimitInfo = {
      lastReset: Date.now(),
      requestsThisMinute: 0,
      maxRequestsPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT || '15')
    };

    // Cache settings
    this.cacheSettings = {
      enabled: process.env.GEMINI_CACHE_ENABLED !== 'false',
      ttlHours: parseInt(process.env.GEMINI_CACHE_TTL_HOURS || '24')
    };
  }

  /**
   * Generate content with rate limiting, retry, and caching
   */
  async generateContent(model, prompt, options = {}) {
    const {
      useCache = true,
      cacheKey = null,
      maxRetries = 3,
      images = []
    } = options;

    // Generate cache key if not provided
    const finalCacheKey = cacheKey || this.generateCacheKey(model, prompt, images);

    // Check cache first
    if (useCache && this.cacheSettings.enabled) {
      const cachedResult = await this.getCachedResult(finalCacheKey);
      if (cachedResult) {
        Logger.info('Gemini cache hit', { cacheKey: finalCacheKey });
        return cachedResult;
      }
    }

    // Rate limit check
    await this.checkRateLimit();

    // Prepare retry options
    const retryOptions = {
      retries: maxRetries,
      factor: 2,
      minTimeout: 2000,
      maxTimeout: 30000,
      onFailedAttempt: (error) => {
        Logger.warn(`Gemini API attempt ${error.attemptNumber} failed`, {
          error: error.message,
          retriesLeft: error.retriesLeft
        });

        // If rate limited, wait longer
        if (error.message.includes('429')) {
          const delay = this.calculateBackoffDelay(error.attemptNumber);
          Logger.info(`Rate limited, waiting ${delay}ms before retry`);
          return new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    try {
      // Execute with retry logic
      const result = await pRetry(async () => {
        try {
          // Track request
          this.trackRequest();

          // Select model
          const modelInstance = this.models[model] || this.models.flash;

          // Prepare content
          let content = [prompt];
          
          // Add images if provided
          if (images.length > 0) {
            for (const image of images) {
              content.push({
                inlineData: {
                  mimeType: image.mimeType || 'image/jpeg',
                  data: image.data
                }
              });
            }
          }

          // Generate content
          const response = await modelInstance.generateContent(content);
          const text = response.response.text();

          // Cache the result
          if (useCache && this.cacheSettings.enabled) {
            await this.cacheResult(finalCacheKey, text);
          }

          return {
            text,
            cached: false,
            model: model
          };

        } catch (error) {
          // Handle specific Gemini errors
          if (error.message.includes('429') || error.message.includes('quota')) {
            throw new Error(`Rate limited: ${error.message}`);
          }
          
          // Re-throw for retry
          throw error;
        }
      }, retryOptions);

      return result;

    } catch (error) {
      Logger.error('Gemini API final failure after retries', {
        error: error.message,
        model,
        cacheKey: finalCacheKey
      });

      // Return fallback response if available
      if (options.fallbackResponse) {
        Logger.info('Using fallback response due to API failure');
        return {
          text: options.fallbackResponse,
          cached: false,
          fallback: true,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Generate content and parse JSON response
   */
  async generateJSON(model, prompt, options = {}) {
    const result = await this.generateContent(model, prompt, options);
    
    try {
      // Extract JSON from response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...result,
        json: parsed
      };

    } catch (error) {
      Logger.error('Failed to parse JSON from Gemini response', {
        error: error.message,
        response: result.text.substring(0, 200)
      });

      // Return structured fallback if provided
      if (options.fallbackJSON) {
        return {
          ...result,
          json: options.fallbackJSON,
          parseError: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Check and enforce rate limits
   */
  async checkRateLimit() {
    const now = Date.now();
    const timeSinceReset = now - this.rateLimitInfo.lastReset;

    // Reset counter if a minute has passed
    if (timeSinceReset >= 60000) {
      this.rateLimitInfo.lastReset = now;
      this.rateLimitInfo.requestsThisMinute = 0;
    }

    // Check if we're at the limit
    if (this.rateLimitInfo.requestsThisMinute >= this.rateLimitInfo.maxRequestsPerMinute) {
      const waitTime = 60000 - timeSinceReset;
      Logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.rateLimitInfo.lastReset = Date.now();
      this.rateLimitInfo.requestsThisMinute = 0;
    }
  }

  /**
   * Track API request
   */
  trackRequest() {
    this.rateLimitInfo.requestsThisMinute++;
    Logger.debug('Gemini API request tracked', {
      requestsThisMinute: this.rateLimitInfo.requestsThisMinute,
      maxPerMinute: this.rateLimitInfo.maxRequestsPerMinute
    });
  }

  /**
   * Calculate backoff delay for retries
   */
  calculateBackoffDelay(attemptNumber) {
    // Exponential backoff with jitter
    const baseDelay = 2000;
    const maxDelay = 60000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(model, prompt, images = []) {
    const content = `${model}:${prompt}:${images.length}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached result
   */
  async getCachedResult(cacheKey) {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_cache')
        .select('cache_data')
        .eq('cache_key', `gemini:${cacheKey}`)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return {
        text: data.cache_data.text,
        cached: true,
        model: data.cache_data.model
      };

    } catch (error) {
      Logger.error('Cache retrieval error', { error: error.message });
      return null;
    }
  }

  /**
   * Cache result
   */
  async cacheResult(cacheKey, text) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.cacheSettings.ttlHours);

      const { error } = await supabase
        .from('ai_analysis_cache')
        .upsert({
          cache_key: `gemini:${cacheKey}`,
          cache_data: { text },
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'cache_key'
        });

      if (error) {
        Logger.error('Cache storage error', { error: error.message });
      }

    } catch (error) {
      Logger.error('Failed to cache result', { error: error.message });
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    try {
      const { error } = await supabase
        .from('ai_analysis_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .like('cache_key', 'gemini:%');

      if (!error) {
        Logger.info('Cleared expired Gemini cache entries');
      }

    } catch (error) {
      Logger.error('Failed to clear expired cache', { error: error.message });
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    const now = Date.now();
    const timeSinceReset = now - this.rateLimitInfo.lastReset;
    const remainingRequests = Math.max(
      0, 
      this.rateLimitInfo.maxRequestsPerMinute - this.rateLimitInfo.requestsThisMinute
    );

    return {
      remainingRequests,
      resetInMs: Math.max(0, 60000 - timeSinceReset),
      currentRequests: this.rateLimitInfo.requestsThisMinute,
      maxRequests: this.rateLimitInfo.maxRequestsPerMinute
    };
  }
}

// Export singleton instance
module.exports = new GeminiWrapper(); 