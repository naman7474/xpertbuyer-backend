// src/controllers/photoController.js
const photoAnalysisService = require('../services/photoAnalysisService');
const supabase = require('../config/database');
const Logger = require('../utils/logger');

class PhotoController {
  /**
   * Upload and process photo
   */
  async uploadPhoto(req, res) {
    try {
      const { user } = req;
      const photoFile = req.file;
      const { photo_type = 'onboarding' } = req.body;

      if (!photoFile) {
        return res.status(400).json({
          success: false,
          error: 'No photo file provided'
        });
      }

      // Process photo
      const result = await photoAnalysisService.uploadAndProcessPhoto(
        user.id,
        photoFile.buffer,
        photo_type
      );

      res.status(200).json({
        success: true,
        data: {
          session_id: result.photo_id,
          photo_id: result.photo_id,
          processing_status: result.processing_status,
          estimated_time: 30
        }
      });

    } catch (error) {
      Logger.error('Photo upload error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to upload and process photo'
      });
    }
  }

  /**
   * Get photo processing status
   */
  async getPhotoStatus(req, res) {
    try {
      const { session_id } = req.params;

      const status = await photoAnalysisService.getPhotoStatus(session_id);

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      Logger.error('Get photo status error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get photo status'
      });
    }
  }

  /**
   * Analyze photo for skin concerns
   */
  async analyzePhoto(req, res) {
    try {
      const { user } = req;
      const { photo_id, analysis_type = 'comprehensive' } = req.body;

      // Get photo analysis results
      const { data: analysis, error } = await supabase
        .from('photo_analyses')
        .select('*')
        .eq('photo_id', photo_id)
        .eq('user_id', user.id)
        .single();

      if (error || !analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found or still processing'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          analysis_id: analysis.id,
          skin_concerns: analysis.skin_concerns,
          skin_attributes: analysis.skin_attributes,
          overall_skin_score: analysis.overall_skin_score,
          ai_observations: analysis.ai_observations,
          positive_attributes: analysis.positive_attributes
        }
      });

    } catch (error) {
      Logger.error('Analyze photo error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze photo'
      });
    }
  }
}

module.exports = new PhotoController();