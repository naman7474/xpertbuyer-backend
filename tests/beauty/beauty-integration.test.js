// tests/beauty/beauty-integration.test.js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', require('../../src/routes/api'));

// Mock all dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/beautyOnboardingService');
jest.mock('../../src/services/photoAnalysisService');
jest.mock('../../src/services/beautyRecommendationService');
jest.mock('../../src/services/searchService');

// Get mocked services
const beautyOnboardingService = require('../../src/services/beautyOnboardingService');
const photoAnalysisService = require('../../src/services/photoAnalysisService');
const beautyRecommendationService = require('../../src/services/beautyRecommendationService');
const searchService = require('../../src/services/searchService');

// Helper to generate auth token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
};

describe('Beauty AI Platform Integration Tests', () => {
  let authToken;
  const testUserId = 'test-user-123';
  
  beforeAll(() => {
    authToken = generateToken(testUserId);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding Flow', () => {
    test('GET /api/profile/beauty/onboarding - should return onboarding progress', async () => {
      beautyOnboardingService.getOnboardingProgress.mockResolvedValue({
        steps: {
          profile: { complete: false, percentage: 60 },
          photo: { uploaded: true, processed: false, status: 'processing' },
          recommendations: { generated: false }
        },
        overallProgress: 40,
        nextStep: 'complete_profile'
      });

      const response = await request(app)
        .get('/api/profile/beauty/onboarding')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallProgress).toBe(40);
      expect(response.body.data.nextStep).toBe('complete_profile');
    });
  });

  describe('Profile Management', () => {
    test('PUT /api/profile/beauty/skin - should update skin profile and check for recommendations', async () => {
      const mockSupabase = require('../../src/config/database');
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                user_id: testUserId,
                skin_type: 'combination',
                skin_tone: 'medium',
                undertone: 'warm'
              },
              error: null
            })
          })
        })
      });

      beautyOnboardingService.onProfileUpdate.mockResolvedValue({
        triggered: false,
        reason: 'profile_incomplete',
        profileCompletion: 80,
        missingFields: ['lifestyle.location']
      });

      const response = await request(app)
        .put('/api/profile/beauty/skin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skin_type: 'combination',
          skin_tone: 'medium',
          undertone: 'warm',
          primary_concerns: ['acne', 'dark_spots'],
          sensitivity_level: 'medium'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.onboardingStatus.profileCompletion).toBe(80);
      expect(beautyOnboardingService.onProfileUpdate).toHaveBeenCalledWith(testUserId, 'skin');
    });

    test('Profile update should trigger recommendations when complete', async () => {
      const mockSupabase = require('../../src/config/database');
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: testUserId, budget_range: '3000_5000' },
              error: null
            })
          })
        })
      });

      beautyOnboardingService.onProfileUpdate.mockResolvedValue({
        triggered: true,
        reason: 'success',
        profileCompletion: 100,
        analysisId: 'analysis-123',
        recommendationCount: {
          morning: 4,
          evening: 5,
          weekly: 2
        }
      });

      const response = await request(app)
        .put('/api/profile/beauty/makeup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          makeup_frequency: 'daily',
          preferred_look: 'natural',
          budget_range: '3000_5000'
        });

      expect(response.status).toBe(200);
      expect(response.body.onboardingStatus.triggered).toBe(true);
      expect(response.body.onboardingStatus.reason).toBe('success');
    });
  });

  describe('Photo Upload & Analysis', () => {
    test('POST /api/photo/upload - should handle photo upload', async () => {
      photoAnalysisService.uploadAndProcessPhoto.mockResolvedValue({
        photo_id: 'photo-123',
        photo_url: 'https://test-url.com/photo.jpg',
        processing_status: 'started'
      });

      const response = await request(app)
        .post('/api/photo/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg')
        .field('photo_type', 'onboarding');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.photo_id).toBe('photo-123');
      expect(response.body.data.processing_status).toBe('started');
    });

    test('GET /api/photo/status/:session_id - should return photo processing status', async () => {
      photoAnalysisService.getPhotoStatus.mockResolvedValue({
        status: 'completed',
        face_model_url: 'https://test-3d-model.com',
        face_landmarks: [],
        processing_time: 25000,
        analysis: {
          skin_concerns: [
            { type: 'acne', severity: 'mild', locations: ['forehead'], confidence: 0.9 }
          ],
          overall_skin_score: 75
        }
      });

      const response = await request(app)
        .get('/api/photo/status/photo-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.analysis.overall_skin_score).toBe(75);
    });
  });

  describe('Beauty Recommendations', () => {
    test('GET /api/recommendations/beauty - should return personalized recommendations', async () => {
      beautyRecommendationService.generateRecommendations.mockResolvedValue({
        routine: {
          morning: [
            {
              step: 1,
              product_type: 'cleanser',
              product_id: 'prod-123',
              product_name: 'Gentle Foaming Cleanser',
              brand: 'CeraVe',
              price: 499,
              key_ingredients: ['salicylic_acid'],
              face_coordinates: {
                markers: [{ x: 0.5, y: 0.5, z: 0.1, type: 'primary' }],
                highlight_regions: ['full_face']
              }
            }
          ],
          evening: [],
          weekly: []
        },
        ai_insights: {
          primary_focus: 'Acne control',
          routine_philosophy: 'Simple and effective'
        }
      });

      const response = await request(app)
        .get('/api/recommendations/beauty')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.routine).toBeDefined();
      expect(response.body.data.routine.morning).toHaveLength(1);
      expect(response.body.data.routine.morning[0].product_name).toBe('Gentle Foaming Cleanser');
      expect(response.body.data.routine.morning[0].face_coordinates).toBeDefined();
    });
  });

  describe('Search with Beauty Context', () => {
    test('POST /api/search - should apply beauty context to search', async () => {
      searchService.search.mockResolvedValue({
        query: 'moisturizer for acne prone skin',
        parsedQuery: {
          type: 'moisturizer',
          concern: 'acne',
          userContext: {
            skinType: 'combination',
            avoidIngredients: ['fragrance']
          }
        },
        products: [
          {
            id: 'prod-456',
            brand: 'La Roche-Posay',
            name: 'Effaclar Mat',
            price: { mrp: 1590, sale: 1350, currency: 'INR' },
            rating: { average: 4.3, count: 234 },
            matchReason: 'Perfect for acne-prone combination skin'
          }
        ],
        personalization: {
          isPersonalized: true,
          skinType: 'combination',
          primaryConcerns: ['acne']
        }
      });

      const response = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'moisturizer for acne prone skin',
          includeIngredients: true
        });

      expect(response.status).toBe(200);
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.personalization.isPersonalized).toBe(true);
      expect(response.body.data.products[0].matchReason).toContain('acne-prone');
    });
  });

  describe('Complete Onboarding Flow', () => {
    test('Should automatically trigger recommendations after profile and photo completion', async () => {
      // Step 1: Complete profile
      const mockSupabase = require('../../src/config/database');
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: testUserId },
              error: null
            })
          })
        })
      });

      // Initial profile update - not complete
      beautyOnboardingService.onProfileUpdate.mockResolvedValueOnce({
        triggered: false,
        reason: 'profile_incomplete',
        profileCompletion: 80
      });

      // Final profile update - triggers recommendations
      beautyOnboardingService.onProfileUpdate.mockResolvedValueOnce({
        triggered: true,
        reason: 'success',
        profileCompletion: 100,
        recommendationCount: {
          morning: 4,
          evening: 5,
          weekly: 2
        }
      });

      // Update skin profile
      let response = await request(app)
        .put('/api/profile/beauty/skin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skin_type: 'combination',
          skin_tone: 'medium',
          undertone: 'warm',
          primary_concerns: ['acne'],
          sensitivity_level: 'medium'
        });

      expect(response.body.onboardingStatus.triggered).toBe(false);

      // Update lifestyle profile (completing all required fields)
      response = await request(app)
        .put('/api/profile/beauty/lifestyle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          location: 'Mumbai, India',
          climate_type: 'humid',
          pollution_level: 'high',
          sun_exposure: 'moderate',
          sleep_hours: 7,
          stress_level: 'moderate',
          exercise_frequency: '3_times_week'
        });

      expect(response.body.onboardingStatus.triggered).toBe(true);
      expect(response.body.onboardingStatus.reason).toBe('success');
      expect(response.body.onboardingStatus.recommendationCount).toBeDefined();
    });
  });
}); 