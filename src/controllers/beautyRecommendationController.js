// src/controllers/beautyRecommendationController.js
const supabase = require('../config/database');
const beautyRecommendationService = require('../services/beautyRecommendationService');
const Logger = require('../utils/logger');

class BeautyRecommendationController {
  /**
   * Get personalized beauty recommendations
   */
  async getRecommendations(req, res) {
    try {
      const { user } = req;

      // Generate or retrieve recommendations
      const recommendations = await beautyRecommendationService.generateRecommendations(user.id);

      res.status(200).json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      Logger.error('Get recommendations error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations'
      });
    }
  }

  /**
   * Submit feedback on recommendation
   */
  async submitFeedback(req, res) {
    try {
      const { user } = req;
      const {
        recommendation_id,
        product_id,
        feedback_type,
        comments,
        rating
      } = req.body;

      // Update recommendation with feedback
      const { error } = await supabase
        .from('product_recommendations')
        .update({
          user_rating: rating,
          user_feedback: comments,
          marked_effective: feedback_type === 'positive',
          updated_at: new Date().toISOString()
        })
        .eq('id', recommendation_id)
        .eq('user_id', user.id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully'
      });

    } catch (error) {
      Logger.error('Submit feedback error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback'
      });
    }
  }
}

module.exports = new BeautyRecommendationController();