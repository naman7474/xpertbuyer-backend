require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const CacheCleanupService = require('./utils/cacheCleanupService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] // Replace with your frontend domain
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to XpertBuyer API',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      search: 'POST /api/search',
      productDetails: 'GET /api/products/:productId',
      compare: 'POST /api/compare',
      productVideos: 'GET /api/products/:productId/videos',
      videosSummary: 'GET /api/videos/products-summary?productIds=id1,id2,id3',
      health: 'GET /api/health'
    }
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize cache cleanup service
const cacheCleanupService = new CacheCleanupService();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 XpertBuyer API server running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  
  // Validate environment variables
  const requiredEnvVars = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Please check your .env file');
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  // Start cache cleanup service
  try {
    cacheCleanupService.startPeriodicCleanup(6); // Clean up every 6 hours
    console.log('🧹 Cache cleanup service initialized');
  } catch (error) {
    console.warn('⚠️  Cache cleanup service failed to start:', error.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  cacheCleanupService.stopPeriodicCleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  cacheCleanupService.stopPeriodicCleanup();
  process.exit(0);
});

module.exports = app; 