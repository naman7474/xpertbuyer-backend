// src/services/photoAnalysisService.js
const supabase = require('../config/database');
const Logger = require('../utils/logger');
const sharp = require('sharp');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const beautyProfileService = require('./beautyProfileService');
const queueService = require('./queueService');

class PhotoAnalysisService {
  constructor() {
    Logger.info('Using Supabase Storage for photo uploads');
    // Face mesh service will be initialized separately
    this.faceMeshService = null;
  }

  /**
   * Initialize face mesh service (lazy loading)
   */
  async initializeFaceMeshService() {
    if (!this.faceMeshService) {
      const { FaceMeshService } = require('./faceMeshService');
      this.faceMeshService = new FaceMeshService();
      await this.faceMeshService.initialize();
    }
    return this.faceMeshService;
  }

  /**
   * Upload and process user photo
   */
  async uploadAndProcessPhoto(userId, photoBuffer, photoType = 'onboarding') {
    try {
      Logger.info('Starting photo upload and processing', { userId, photoType });

      // Generate unique photo ID
      const photoId = uuidv4();
      const timestamp = Date.now();
      const fileName = `${userId}/${photoType}/${photoId}_${timestamp}.jpg`;

      // Process and optimize image
      const processedBuffer = await this.preprocessImage(photoBuffer);

      // Upload to storage (using existing beauty-ai-photos bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('beauty-ai-photos')
        .upload(fileName, processedBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('beauty-ai-photos')
        .getPublicUrl(fileName);

      // Create database record
      const { data: photoRecord, error: dbError } = await supabase
        .from('photo_uploads')
        .insert({
          user_id: userId,
          photo_url: publicUrl,
          photo_type: photoType,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Add job to queue instead of direct processing
      const job = await queueService.addPhotoProcessingJob({
        photoId: photoRecord.id,
        userId: userId,
        imageBuffer: processedBuffer.toString('base64'), // Convert to base64 for queue storage
        photoType: photoType
      });

      Logger.info('Photo processing job queued', {
        jobId: job.id,
        photoId: photoRecord.id,
        userId
      });

      return {
        photo_id: photoRecord.id,
        photo_url: publicUrl,
        processing_status: 'queued',
        job_id: job.id
      };

    } catch (error) {
      Logger.error('Photo upload error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Preprocess image for optimal analysis
   */
  async preprocessImage(imageBuffer) {
    try {
      // Resize and optimize image
      const processed = await sharp(imageBuffer)
        .resize(1024, 1024, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 90,
          progressive: true
        })
        .toBuffer();

      return processed;
    } catch (error) {
      Logger.error('Image preprocessing error', { error: error.message });
      throw error;
    }
  }

  /**
   * Process photo from queue job
   * Static method to be used by queue worker
   */
  static async processPhotoFromQueue(jobData) {
    const { photoId, userId, imageBuffer, photoType } = jobData;
    const startTime = Date.now();
    
    try {
      // Convert base64 back to buffer
      const photoBuffer = Buffer.from(imageBuffer, 'base64');
      
      // Create instance for processing
      const service = new PhotoAnalysisService();
      
      // Update status to processing
      await service.updatePhotoStatus(photoId, 'processing');

      // Run parallel processing
      const [faceMeshResult, skinAnalysis] = await Promise.all([
        service.generateFaceMesh(photoBuffer),
        service.analyzeSkinWithGemini(photoBuffer)
      ]);

      // Update photo record with results
      const processingTime = Date.now() - startTime;
      
      await supabase
        .from('photo_uploads')
        .update({
          face_model_url: faceMeshResult.modelUrl,
          face_landmarks: faceMeshResult.landmarks,
          face_mesh_data: faceMeshResult.meshData,
          processing_status: 'completed',
          processing_time_ms: processingTime
        })
        .eq('id', photoId);

      // Save skin analysis
      const analysisRecord = await service.saveSkinAnalysis(photoId, userId, skinAnalysis);

      Logger.info('Photo processing completed', { 
        photoId, 
        processingTime,
        skinScore: skinAnalysis.overall_skin_score 
      });

      // Trigger recommendations if profile is complete
      await beautyProfileService.onPhotoAnalysisComplete(
        userId, 
        photoId, 
        analysisRecord.id
      );

      return {
        success: true,
        photoId,
        analysisId: analysisRecord.id,
        processingTime
      };

    } catch (error) {
      Logger.error('Photo processing error', { 
        error: error.message, 
        photoId 
      });
      
      // Update status to failed
      await PhotoAnalysisService.updatePhotoStatusStatic(photoId, 'failed');
      throw error;
    }
  }

  /**
   * Static method to update photo status
   */
  static async updatePhotoStatusStatic(photoId, status) {
    const { error } = await supabase
      .from('photo_uploads')
      .update({ processing_status: status })
      .eq('id', photoId);

    if (error) {
      Logger.error('Update photo status error', { error: error.message });
    }
  }

  /**
   * Process photo asynchronously (deprecated - use queue instead)
   * @deprecated Use queue service instead
   */
  async processPhotoAsync(photoId, userId, imageBuffer) {
    // This method is deprecated
    Logger.warn('processPhotoAsync called directly - should use queue service');
    
    // Fallback to queue
    return queueService.addPhotoProcessingJob({
      photoId,
      userId,
      imageBuffer: imageBuffer.toString('base64'),
      photoType: 'onboarding'
    });
  }

  /**
   * Generate 3D face mesh using MediaPipe or similar
   */
  async generateFaceMesh(imageBuffer) {
    try {
      const faceMesh = await this.initializeFaceMeshService();
      const result = await faceMesh.processImage(imageBuffer);

      // Upload 3D model file
      const modelFileName = `models/${uuidv4()}.obj`;
      const { data: modelUpload, error } = await supabase.storage
        .from('3d-models')
        .upload(modelFileName, result.objFile, {
          contentType: 'model/obj'
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('3d-models')
        .getPublicUrl(modelFileName);

      return {
        modelUrl: publicUrl,
        landmarks: result.landmarks,
        meshData: result.meshData
      };

    } catch (error) {
      Logger.error('Face mesh generation error', { error: error.message });
      // Return fallback data
      return {
        modelUrl: null,
        landmarks: [],
        meshData: {}
      };
    }
  }

  /**
   * Analyze skin using Gemini Vision API
   */
  async analyzeSkinWithGemini(imageBuffer) {
    try {
      // Convert image to base64 for Gemini
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Analyze this face photo for skincare assessment. Provide a detailed analysis including:

1. Skin Concerns (identify all visible issues):
   - Type of concern (acne, dark spots, wrinkles, redness, etc.)
   - Severity (mild, moderate, severe)
   - Location on face (forehead, cheeks, nose, chin, etc.)
   - Confidence score (0-1)

2. Skin Attributes:
   - Skin tone (fair, light, medium, tan, deep)
   - Undertone (warm, cool, neutral)
   - Skin texture appearance
   - Estimated age appearance

3. Positive Attributes (healthy skin indicators)

4. Overall skin health score (0-100)

Return the analysis in JSON format with the structure:
{
  "skin_concerns": [
    {
      "type": "string",
      "severity": "string",
      "locations": ["string"],
      "confidence": number
    }
  ],
  "skin_attributes": {
    "tone": "string",
    "undertone": "string",
    "texture": "string",
    "age_appearance": number
  },
  "positive_attributes": ["string"],
  "overall_skin_score": number,
  "ai_observations": ["string"],
  "improvement_areas": ["string"]
}`;

      // Use geminiWrapper instead of direct API call
      const geminiWrapper = require('./geminiWrapper');
      const result = await geminiWrapper.generateJSON('vision', prompt, {
        images: [{
          data: base64Image,
          mimeType: 'image/jpeg'
        }],
        useCache: true,
        fallbackJSON: this.getDefaultSkinAnalysis()
      });

      // Validate and sanitize the analysis
      return this.validateSkinAnalysis(result.json);

    } catch (error) {
      Logger.error('Gemini skin analysis error', { error: error.message });
      // Return default analysis
      return this.getDefaultSkinAnalysis();
    }
  }

  /**
   * Validate and sanitize skin analysis results
   */
  validateSkinAnalysis(analysis) {
    const validated = {
      skin_concerns: [],
      skin_attributes: {
        tone: 'medium',
        undertone: 'neutral',
        texture: 'normal',
        age_appearance: 25
      },
      positive_attributes: [],
      overall_skin_score: 70,
      ai_observations: [],
      improvement_areas: []
    };

    // Validate skin concerns
    if (Array.isArray(analysis.skin_concerns)) {
      validated.skin_concerns = analysis.skin_concerns.filter(concern => 
        concern.type && concern.severity && Array.isArray(concern.locations)
      ).slice(0, 10); // Limit to 10 concerns
    }

    // Validate skin attributes
    if (analysis.skin_attributes && typeof analysis.skin_attributes === 'object') {
      validated.skin_attributes = {
        ...validated.skin_attributes,
        ...analysis.skin_attributes
      };
    }

    // Validate arrays
    ['positive_attributes', 'ai_observations', 'improvement_areas'].forEach(key => {
      if (Array.isArray(analysis[key])) {
        validated[key] = analysis[key].slice(0, 5); // Limit array sizes
      }
    });

    // Validate skin score
    if (typeof analysis.overall_skin_score === 'number') {
      validated.overall_skin_score = Math.max(0, Math.min(100, analysis.overall_skin_score));
    }

    return validated;
  }

  /**
   * Get default skin analysis (fallback)
   */
  getDefaultSkinAnalysis() {
    return {
      skin_concerns: [
        {
          type: 'analysis_pending',
          severity: 'unknown',
          locations: ['full_face'],
          confidence: 0
        }
      ],
      skin_attributes: {
        tone: 'medium',
        undertone: 'neutral',
        texture: 'normal',
        age_appearance: 25
      },
      positive_attributes: ['healthy_appearance'],
      overall_skin_score: 70,
      ai_observations: ['Analysis could not be completed'],
      improvement_areas: ['Please try uploading a clearer photo']
    };
  }

  /**
   * Save skin analysis to database
   */
  async saveSkinAnalysis(photoId, userId, analysis) {
    try {
      // Ensure arrays are properly formatted
      const insertData = {
        photo_id: photoId,
        user_id: userId,
        skin_concerns: analysis.skin_concerns,
        skin_attributes: analysis.skin_attributes,
        overall_skin_score: analysis.overall_skin_score,
        ai_observations: Array.isArray(analysis.ai_observations) ? analysis.ai_observations : [analysis.ai_observations].filter(Boolean),
        improvement_areas: Array.isArray(analysis.improvement_areas) ? analysis.improvement_areas : [analysis.improvement_areas].filter(Boolean),
        positive_attributes: Array.isArray(analysis.positive_attributes) ? analysis.positive_attributes : [analysis.positive_attributes].filter(Boolean),
        confidence_score: 0.85
      };

      const { data, error } = await supabase
        .from('photo_analyses')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      Logger.error('Save skin analysis error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update photo processing status
   */
  async updatePhotoStatus(photoId, status) {
    const { error } = await supabase
      .from('photo_uploads')
      .update({ processing_status: status })
      .eq('id', photoId);

    if (error) {
      Logger.error('Update photo status error', { error: error.message });
    }
  }

  /**
   * Get photo processing status
   */
  async getPhotoStatus(sessionId) {
    try {
      const { data, error } = await supabase
        .from('photo_uploads')
        .select(`
          *,
          photo_analyses(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return {
        status: data.processing_status,
        face_model_url: data.face_model_url,
        face_landmarks: data.face_landmarks,
        processing_time: data.processing_time_ms,
        analysis: data.photo_analyses?.[0] || null
      };

    } catch (error) {
      Logger.error('Get photo status error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new PhotoAnalysisService();