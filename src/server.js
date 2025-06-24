require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const cacheCleanupService = require('./utils/cacheCleanupService');
const { refreshDatabase } = require('./utils/refreshDatabase');
const Logger = require('./utils/logger');
const queueService = require('./services/queueService');
const photoAnalysisService = require('./services/photoAnalysisService');

const app = express();
const PORT = process.env.PORT || 5000;

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
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  if (req.path !== '/health' && req.path !== '/api/health') {
    const origin = req.headers.origin || req.headers.referer || 'no-origin';
    if (origin === 'no-origin' || origin === 'undefined') {
      console.log('CORS check - origin:', origin, 'allowed:', [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173'
      ]);
    }
  }
  next();
});

// API routes
app.use('/api', apiRoutes);

// Serve static files for photo uploads (if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Initialize queue worker
let photoWorker = null;

async function initializeWorkers() {
  try {
    // Initialize photo processing worker
    photoWorker = queueService.initializePhotoWorker(
      photoAnalysisService.processPhotoFromQueue
    );
    
    Logger.info('Queue workers initialized successfully');
  } catch (error) {
    Logger.error('Failed to initialize queue workers', { error: error.message });
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  Logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      Logger.info('HTTP server closed');
    });

    // Stop cache cleanup service
    await cacheCleanupService.stop();
    
    // Shutdown queue service
    await queueService.shutdown();
    
    // Give some time for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    Logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Refresh database connection first
    Logger.info('Refreshing database connection and schema cache...');
    await refreshDatabase();
    Logger.info('Database schema refreshed successfully');

    // Initialize workers
    await initializeWorkers();

    // Start server
    const server = app.listen(PORT, () => {
      Logger.info('XpertBuyer API server running on port ' + PORT, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT.toString()
      });

      // Start cache cleanup service
      cacheCleanupService.start();
      Logger.info('Cache cleanup service initialized');
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Store server reference for graceful shutdown
    global.server = server;

  } catch (error) {
    Logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start the server
startServer();

// Export app for testing
module.exports = app; 