const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/database');

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
      console.error('User creation error:', userError);
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
      console.error('Session creation error:', sessionError);
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
    console.error('Registration error:', error);
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
      console.error('Session creation error:', sessionError);
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
    console.error('Login error:', error);
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
      console.error('Logout error:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
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
      console.error('Token refresh error:', error);
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
    console.error('Token refresh error:', error);
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
        skin_profiles(*),
        hair_profiles(*),
        lifestyle_demographics(*),
        health_medical_conditions(*),
        makeup_preferences(*)
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
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
    console.error('Get profile error:', error);
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
      console.error('Profile update error:', updateError);
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
    console.error('Update profile error:', error);
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