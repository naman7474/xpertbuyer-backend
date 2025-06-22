// tests/beauty/beauty.test.js
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

// Create a test app instance
const app = express();
app.use(express.json());

// Import routes
const apiRoutes = require('../../src/routes/api');
app.use('/api', apiRoutes);

// Mock database
jest.mock('../../src/config/database', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ 
          data: { 
            id: 'test-user-id-123', 
            skin_type: 'combination',
            primary_skin_concerns: ['acne']
          }, 
          error: null 
        })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      gte: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
      }))
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test-url.com' } }))
    }))
  }
}));

// Mock services
jest.mock('../../src/services/beautyOnboardingService', () => ({
  onProfileUpdate: jest.fn(() => Promise.resolve({
    triggered: false,
    reason: 'profile_incomplete',
    profileCompletion: 80
  })),
  getOnboardingProgress: jest.fn(() => Promise.resolve({
    steps: {
      profile: { complete: false, percentage: 80 },
      photo: { uploaded: false, processed: false },
      recommendations: { generated: false }
    },
    overallProgress: 40,
    nextStep: 'complete_profile'
  }))
}));

jest.mock('../../src/services/photoAnalysisService', () => ({
  uploadAndProcessPhoto: jest.fn(() => Promise.resolve({
    photo_id: 'test-photo-id',
    photo_url: 'https://test-url.com',
    processing_status: 'started'
  })),
  getPhotoStatus: jest.fn(() => Promise.resolve({
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
  }))
}));

jest.mock('../../src/services/beautyRecommendationService', () => ({
  generateRecommendations: jest.fn(() => Promise.resolve({
    routine: {
      morning: [{
        step: 1,
        product_type: 'cleanser',
        product_id: 'test-product-id',
        product_name: 'Test Cleanser',
        brand: 'Test Brand',
        price: 499,
        face_coordinates: {
          markers: [{ x: 0.5, y: 0.5, z: 0.1, type: 'primary' }],
          highlight_regions: ['full_face']
        }
      }],
      evening: [],
      weekly: []
    },
    ai_insights: {
      primary_focus: 'Acne control',
      routine_philosophy: 'Simple and effective'
    }
  }))
}));

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
};

describe('Beauty AI Platform Tests', () => {
  let authToken;
  let testUserId;
  let testPhotoId;
  let testAnalysisId;
  
  // Test data
  const testUser = {
    email: 'beautytest@example.com',
    password: 'Test123!@#',
    first_name: 'Beauty',
    last_name: 'Tester'
  };

  const testBeautyProfile = {
    skin_type: 'combination',
    skin_tone: 'medium',
    undertone: 'warm',
    primary_concerns: ['acne', 'dark_spots'],
    sensitivity_level: 'medium',
    allergies: ['fragrance']
  };

  beforeAll(async () => {
    // Create test user ID
    testUserId = 'test-user-id-123';
    authToken = generateToken(testUserId);
  });

  afterAll(async () => {
    // Cleanup is handled by mocks
  });

  describe('Photo Upload & Processing', () => {
    test('POST /api/photo/upload - should upload photo successfully', async () => {
      // Read test image
      const testImagePath = path.join(__dirname, 'fixtures', 'test-face.jpg');
      const imageBuffer = await fs.readFile(testImagePath);
      
      const response = await request(app)
        .post('/api/photo/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', imageBuffer, 'test-face.jpg')
        .field('photo_type', 'onboarding');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('session_id');
      expect(response.body.data).toHaveProperty('photo_id');
      expect(response.body.data.processing_status).toBe('started');
      
      testPhotoId = response.body.data.photo_id;
    });

    test('POST /api/photo/upload - should reject invalid file types', async () => {
      const response = await request(app)
        .post('/api/photo/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', Buffer.from('invalid'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('GET /api/photo/status/:session_id - should return processing status', async () => {
      const response = await request(app)
        .get(`/api/photo/status/${testPhotoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(response.body.data.status);
    });

    test('POST /api/photo/analyze - should analyze photo', async () => {
      // Wait for processing to complete (mock)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await request(app)
        .post('/api/photo/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photo_id: testPhotoId,
          analysis_type: 'comprehensive'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('analysis_id');
      expect(response.body.data).toHaveProperty('skin_concerns');
      expect(response.body.data).toHaveProperty('overall_skin_score');
      
      testAnalysisId = response.body.data.analysis_id;
    });
  });

  describe('Beauty Profile Management', () => {
    test('GET /api/profile/beauty/complete - should return completion status', async () => {
      const response = await request(app)
        .get('/api/profile/beauty/complete')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('completion_status');
      expect(response.body.data).toHaveProperty('overall_completion');
      expect(response.body.data).toHaveProperty('next_step');
    });

    test('PUT /api/profile/beauty/skin - should update skin profile', async () => {
      const response = await request(app)
        .put('/api/profile/beauty/skin')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testBeautyProfile);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.skin_type).toBe(testBeautyProfile.skin_type);
    });

    test('PUT /api/profile/beauty/hair - should update hair profile', async () => {
      const hairProfile = {
        hair_type: 'wavy',
        hair_texture: 'medium',
        scalp_condition: 'normal',
        primary_concerns: ['frizz', 'dryness'],
        chemical_treatments: ['color'],
        styling_frequency: 'weekly'
      };

      const response = await request(app)
        .put('/api/profile/beauty/hair')
        .set('Authorization', `Bearer ${authToken}`)
        .send(hairProfile);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('PUT /api/profile/beauty/lifestyle - should update lifestyle', async () => {
      const lifestyleProfile = {
        location: 'Mumbai, India',
        climate_type: 'humid',
        pollution_level: 'high',
        sun_exposure: 'moderate',
        sleep_hours: 7,
        stress_level: 'moderate',
        exercise_frequency: '3_times_week'
      };

      const response = await request(app)
        .put('/api/profile/beauty/lifestyle')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lifestyleProfile);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('Should validate profile inputs', async () => {
      const invalidProfile = {
        skin_type: 'invalid_type',
        skin_tone: 'invalid_tone'
      };

      const response = await request(app)
        .put('/api/profile/beauty/skin')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProfile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Beauty Recommendations', () => {
    test('GET /api/recommendations/beauty - should return recommendations', async () => {
      const response = await request(app)
        .get('/api/recommendations/beauty')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('routine');
      expect(response.body.data.routine).toHaveProperty('morning');
      expect(response.body.data.routine).toHaveProperty('evening');
      expect(response.body.data).toHaveProperty('ai_insights');
    });

    test('Recommendations should include 3D mapping data', async () => {
      const response = await request(app)
        .get('/api/recommendations/beauty')
        .set('Authorization', `Bearer ${authToken}`);

      const morningRoutine = response.body.data.routine.morning;
      expect(morningRoutine.length).toBeGreaterThan(0);
      
      const firstProduct = morningRoutine[0];
      expect(firstProduct).toHaveProperty('face_coordinates');
      expect(firstProduct.face_coordinates).toHaveProperty('markers');
      expect(firstProduct.face_coordinates).toHaveProperty('highlight_regions');
    });

    test('POST /api/recommendations/feedback - should submit feedback', async () => {
      const feedback = {
        recommendation_id: 'test-rec-id',
        product_id: 'test-product-id',
        feedback_type: 'positive',
        comments: 'Great product!',
        rating: 5
      };

      const response = await request(app)
        .post('/api/recommendations/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send(feedback);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    test('POST /api/progress/photo - should upload progress photo', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-face.jpg');
      const imageBuffer = await fs.readFile(testImagePath);
      
      const response = await request(app)
        .post('/api/progress/photo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', imageBuffer, 'progress.jpg')
        .field('week_number', '4');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('progress_id');
    });

    test('GET /api/progress/timeline - should return progress timeline', async () => {
      const response = await request(app)
        .get('/api/progress/timeline')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('baseline');
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('ai_analysis');
    });
  });

  describe('Routine Tracking', () => {
    test('POST /api/routine/track - should track daily routine', async () => {
      const routineData = {
        date: new Date().toISOString().split('T')[0],
        morning_completed: true,
        evening_completed: false,
        skipped_products: ['serum'],
        skin_feeling: 'normal',
        notes: 'Ran out of serum'
      };

      const response = await request(app)
        .post('/api/routine/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send(routineData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('GET /api/routine/history - should return routine history', async () => {
      const response = await request(app)
        .get('/api/routine/history?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('adherence_rate');
    });
  });

  describe('Integration Tests', () => {
    test('Complete onboarding flow', async () => {
      // 1. Upload photo
      const photoResponse = await uploadTestPhoto();
      expect(photoResponse.status).toBe(200);
      
      // 2. Update all profile sections
      await updateAllProfiles();
      
      // 3. Check completion status
      const completionResponse = await request(app)
        .get('/api/profile/beauty/complete')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(completionResponse.body.data.overall_completion).toBe(100);
      
      // 4. Get recommendations
      const recsResponse = await request(app)
        .get('/api/recommendations/beauty')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(recsResponse.status).toBe(200);
      expect(recsResponse.body.data.routine.morning.length).toBeGreaterThan(0);
    });

    test('Search with beauty context', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'face wash',
          includeIngredients: true
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('beauty_context_applied');
    });
  });

  // Helper functions
  async function uploadTestPhoto() {
    const testImagePath = path.join(__dirname, 'fixtures', 'test-face.jpg');
    const imageBuffer = await fs.readFile(testImagePath);
    
    return request(app)
      .post('/api/photo/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('photo', imageBuffer, 'test.jpg')
      .field('photo_type', 'onboarding');
  }

  async function updateAllProfiles() {
    const profiles = [
      { endpoint: 'skin', data: testBeautyProfile },
      { endpoint: 'hair', data: { hair_type: 'wavy', hair_texture: 'medium' } },
      { endpoint: 'lifestyle', data: { location: 'Mumbai', climate_type: 'humid' } },
      { endpoint: 'health', data: { hormonal_status: 'normal', age: 28 } },
      { endpoint: 'makeup', data: { makeup_frequency: 'daily', preferred_look: 'natural' } }
    ];

    for (const profile of profiles) {
      await request(app)
        .put(`/api/profile/beauty/${profile.endpoint}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(profile.data);
    }
  }
});

// Performance tests
describe('Beauty AI Performance Tests', () => {
  test('Photo processing should complete within 60 seconds', async () => {
    const start = Date.now();
    
    // Upload photo
    const uploadResponse = await uploadTestPhoto();
    const photoId = uploadResponse.body.data.photo_id;
    
    // Poll for completion
    let status = 'processing';
    while (status === 'processing' && Date.now() - start < 60000) {
      const statusResponse = await request(app)
        .get(`/api/photo/status/${photoId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      status = statusResponse.body.data.status;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(60000);
    expect(status).toBe('completed');
  });

  test('Recommendation generation should be fast', async () => {
    const start = Date.now();
    
    const response = await request(app)
      .get('/api/recommendations/beauty')
      .set('Authorization', `Bearer ${authToken}`);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(response.status).toBe(200);
  });
});

// Mock implementations for testing
jest.mock('../../src/services/faceMeshService', () => ({
  processImage: jest.fn().mockResolvedValue({
    objFile: Buffer.from('mock obj data'),
    landmarks: Array(468).fill({ x: 0, y: 0, z: 0 }),
    meshData: { vertices: [], faces: [], uvs: [] }
  })
}));

jest.mock('../../src/config/gemini', () => ({
  models: {
    vision: {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            skin_concerns: [
              { type: 'acne', severity: 'mild', locations: ['forehead'], confidence: 0.9 }
            ],
            skin_attributes: {
              tone: 'medium',
              undertone: 'warm',
              texture: 'normal',
              age_appearance: 25
            },
            overall_skin_score: 75
          })
        }
      })
    },
    flash: {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            routine: {
              morning: [
                {
                  step: 1,
                  product_type: 'cleanser',
                  key_ingredients: ['salicylic acid'],
                  recommendation_reason: 'For acne-prone skin'
                }
              ],
              evening: []
            },
            ai_insights: {
              primary_focus: 'Acne control',
              routine_philosophy: 'Simple and effective'
            }
          })
        }
      })
    }
  }
}));

// Helper functions moved to top level
async function uploadTestPhoto() {
  const testImagePath = path.join(__dirname, 'fixtures', 'test-face.jpg');
  const imageBuffer = await fs.readFile(testImagePath);
  
  return request(app)
    .post('/api/photo/upload')
    .set('Authorization', `Bearer ${authToken}`)
    .attach('photo', imageBuffer, 'test.jpg')
    .field('photo_type', 'onboarding');
}

async function updateAllProfiles() {
  const profiles = [
    { endpoint: 'skin', data: testBeautyProfile },
    { endpoint: 'hair', data: { hair_type: 'wavy', hair_texture: 'medium' } },
    { endpoint: 'lifestyle', data: { location: 'Mumbai', climate_type: 'humid' } },
    { endpoint: 'health', data: { hormonal_status: 'normal', age: 28 } },
    { endpoint: 'makeup', data: { makeup_frequency: 'daily', preferred_look: 'natural' } }
  ];

  for (const profile of profiles) {
    await request(app)
      .put(`/api/profile/beauty/${profile.endpoint}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(profile.data);
  }
}

// Variables that need to be in scope
let authToken;
let testUserId;
let testBeautyProfile;

module.exports = {
  PhotoController: new PhotoController(),
  BeautyProfileController: new BeautyProfileController(),
  BeautyRecommendationController: new BeautyRecommendationController()
};