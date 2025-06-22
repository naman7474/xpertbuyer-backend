const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/database');
const Logger = require('../utils/logger');

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper function to hash token for storage
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Helper function to get device info
const getDeviceInfo = (req) => {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    deviceType: req.headers['user-agent']?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop'
  };
};

// Register new user
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      date_of_birth,
      gender
    } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash,
        first_name,
        last_name,
        phone,
        date_of_birth,
        gender
      }])
      .select('id, email, first_name, last_name, phone, date_of_birth, gender, created_at')
      .single();

    if (userError) {
      Logger.error('User creation error', { error: userError.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);
    const tokenHash = hashToken(token);
    const deviceInfo = getDeviceInfo(req);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert([{
        user_id: user.id,
        token_hash: tokenHash,
        device_info: deviceInfo,
        ip_address: req.ip,
        expires_at: expiresAt.toISOString()
      }]);

    if (sessionError) {
      Logger.error('Session creation error', { error: sessionError.message });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token,
        expires_at: expiresAt
      }
    });

  } catch (error) {
    Logger.error('Registration error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user with password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);
    const tokenHash = hashToken(token);
    const deviceInfo = getDeviceInfo(req);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert([{
        user_id: user.id,
        token_hash: tokenHash,
        device_info: deviceInfo,
        ip_address: req.ip,
        expires_at: expiresAt.toISOString()
      }]);

    if (sessionError) {
      Logger.error('Session creation error', { error: sessionError.message });
    }

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
        expires_at: expiresAt
      }
    });

  } catch (error) {
    Logger.error('Login error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// Logout user
const logout = async (req, res) => {
  try {
    const { sessionId } = req;

    // Deactivate session
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (error) {
      Logger.error('Logout error', { error: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    Logger.error('Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { user, sessionId } = req;

    // Generate new token
    const newToken = generateToken(user.id);
    const newTokenHash = hashToken(newToken);

    // Update session with new token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const { error } = await supabase
      .from('user_sessions')
      .update({
        token_hash: newTokenHash,
        expires_at: expiresAt.toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      Logger.error('Token refresh error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        expires_at: expiresAt
      }
    });

  } catch (error) {
    Logger.error('Token refresh error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const { user } = req;

    // Get complete user profile with all related data
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        beauty_profiles(*)
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      Logger.error('Profile fetch error', { error: profileError.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      });
    }

    // Remove password from response
    const { password_hash, ...profileWithoutPassword } = userProfile;

    res.status(200).json({
      success: true,
      data: profileWithoutPassword
    });

  } catch (error) {
    Logger.error('Get profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile'
    });
  }
};

// Update basic user profile
const updateProfile = async (req, res) => {
  try {
    const { user } = req;
    const {
      first_name,
      last_name,
      phone,
      date_of_birth,
      gender
    } = req.body;

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone,
        date_of_birth,
        gender,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select('id, email, first_name, last_name, phone, date_of_birth, gender, updated_at')
      .single();

    if (updateError) {
      Logger.error('Profile update error', { error: updateError.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });

  } catch (error) {
    Logger.error('Update profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating profile'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  getProfile,
  updateProfile
}; 