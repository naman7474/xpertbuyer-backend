require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const CacheCleanupService = require('./utils/cacheCleanupService');
const { refreshDatabase } = require('./utils/refreshDatabase');
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
    // Add both with and without trailing slash, and log for debugging
    const frontendUrl = process.env.FRONTEND_URL;
    const origins = frontendUrl ? [frontendUrl, frontendUrl.replace(/\/$/, ''), frontendUrl + '/'] : [];
    
    // For debugging - also allow the common frontend URL
    origins.push('https://xpertbuyer-frontend.vercel.app');
    origins.push('https://xpertbuyer-frontend.vercel.app/');
    
    console.log('Production CORS origins:', origins);
    return origins;
  }
  return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
};

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    console.log('CORS check - origin:', origin, 'allowed:', allowedOrigins);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
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
    // Only exit in non-Vercel environments to prevent serverless function crashes
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    } else {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }
  
  // Validate JWT secret strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    Logger.error('JWT_SECRET must be at least 32 characters in production');
    // Only exit in non-Vercel environments
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    } else {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
  }
  
  Logger.info('Environment validation passed');
};

// Start server (only when not in Vercel serverless environment)
const startServer = async () => {
  try {
    validateEnvironment();
    
    // Refresh database connection and schema cache on startup
    try {
      await refreshDatabase();
      Logger.info('Database schema refreshed successfully');
    } catch (error) {
      Logger.warn('Database refresh failed, but continuing startup', { error: error.message });
    }
    
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

// Only set up server and process handlers when not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled promise rejection', { reason, promise });
  });

  startServer();
} else {
  // Vercel serverless - just validate environment
  try {
    validateEnvironment();
  } catch (error) {
    Logger.error('Environment validation failed in serverless', { error: error.message });
  }
}

// Export app for testing
module.exports = app; 