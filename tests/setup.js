// tests/setup.js
require('dotenv').config({ path: '.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Set test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('../src/services/photoAnalysisService', () => ({
  uploadAndProcessPhoto: jest.fn(),
  getPhotoStatus: jest.fn(),
}));

jest.mock('../src/services/beautyRecommendationService', () => ({
  generatePersonalizedRecommendations: jest.fn(),
  submitProductFeedback: jest.fn(),
}));

jest.mock('../src/config/database', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
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
    }))
  }))
}));

// Console spy to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 