const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong. Please try again later.'
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.error = 'Validation error';
    error.message = err.message;
    return res.status(400).json(error);
  }

  // Supabase errors
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

  // Custom application errors
  if (err.message) {
    error.message = err.message;
  }

  // Determine status code
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json(error);
};

const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
}; 