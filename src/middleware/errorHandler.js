const Logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log error with context
  Logger.error('Request error', {
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let error = {
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong. Please try again later.'
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.error = 'Validation error';
    error.message = process.env.NODE_ENV === 'production' 
      ? 'Invalid input data' 
      : err.message;
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error.error = 'Authentication error';
    error.message = 'Invalid or expired token';
    return res.status(401).json(error);
  }

  // Supabase/Database errors
  if (err.code && err.message) {
    error.error = 'Database error';
    error.message = 'Unable to process your request. Please try again.';
    return res.status(500).json(error);
  }

  // Gemini API errors
  if (err.message && err.message.includes('Gemini')) {
    error.error = 'AI service error';
    error.message = 'AI service is temporarily unavailable. Please try again.';
    return res.status(503).json(error);
  }

  // Rate limit errors
  if (err.status === 429) {
    error.error = 'Rate limit exceeded';
    error.message = 'Too many requests. Please try again later.';
    return res.status(429).json(error);
  }

  // Custom application errors with status codes
  const statusCode = err.statusCode || err.status || 500;
  
  // Only expose custom error messages in development or for client errors (4xx)
  if (process.env.NODE_ENV !== 'production' || (statusCode >= 400 && statusCode < 500)) {
    if (err.message && err.message !== 'Internal server error') {
      error.message = err.message;
    }
  }

  res.status(statusCode).json(error);
};

const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
}; 