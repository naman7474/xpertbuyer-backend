require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const CacheCleanupService = require('./utils/cacheCleanupService');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// CORS configuration with environment-based origins
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [];
  }
  return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  optionsSuccessStatus: 200
}));

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks in production
    return process.env.NODE_ENV === 'production' && req.path === '/api/health';
  }
});

app.use(limiter);

// Body parsing middleware with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use(Logger.request);

// API routes
app.use('/api', apiRoutes);

// Root endpoint - minimal in production
app.get('/', (req, res) => {
  const response = {
    success: true,
    message: 'XpertBuyer API',
    version: '1.0.0'
  };

  // Only show detailed endpoints in development
  if (process.env.NODE_ENV !== 'production') {
    response.documentation = '/api/health';
    response.endpoints = {
      search: 'POST /api/search',
      productDetails: 'GET /api/products/:productId',
      compare: 'POST /api/compare',
      productVideos: 'GET /api/products/:productId/videos',
      videosSummary: 'GET /api/videos/products-summary?productIds=id1,id2,id3',
      health: 'GET /api/health'
    };
  }

  res.json(response);
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize cache cleanup service
const cacheCleanupService = new CacheCleanupService();

// Environment variable validation
const validateEnvironment = () => {
  const requiredEnvVars = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    Logger.error('Missing required environment variables', { missingVars });
    process.exit(1);
  }
  
  // Validate JWT secret strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    Logger.error('JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
  
  Logger.info('Environment validation passed');
};

// Start server
const startServer = () => {
  try {
    validateEnvironment();
    
    app.listen(PORT, () => {
      Logger.info(`XpertBuyer API server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
      });
      
      // Start cache cleanup service
      try {
        cacheCleanupService.startPeriodicCleanup(6);
        Logger.info('Cache cleanup service initialized');
      } catch (error) {
        Logger.warn('Cache cleanup service failed to start', { error: error.message });
      }
    });
  } catch (error) {
    Logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  Logger.info(`${signal} received, shutting down gracefully`);
  
  cacheCleanupService.stopPeriodicCleanup();
  
  // Give the server time to finish existing requests
  setTimeout(() => {
    process.exit(0);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled promise rejection', { reason, promise });
  process.exit(1);
});

startServer();

module.exports = app; 