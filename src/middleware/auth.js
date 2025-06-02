const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, is_active, profile_completed')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found or inactive' 
      });
    }

    // Create token hash for session validation
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Validate session with token hash
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('id, user_id, expires_at, is_active')
      .eq('user_id', decoded.userId)
      .eq('token_hash', tokenHash)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired session' 
      });
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid token format' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, is_active, profile_completed')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (user && !error) {
      // For optional auth, also validate session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const { data: session } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', decoded.userId)
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      req.user = session ? user : null;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }
  
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth
}; 