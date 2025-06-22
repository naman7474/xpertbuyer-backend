const supabase = require('../config/database');
const multer = require('multer');
const path = require('path');
const aiAnalysisService = require('../services/aiAnalysisService');
const Logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to upload image to Supabase Storage
const uploadImageToSupabase = async (file, userId, type) => {
  try {
    const fileName = `${userId}/${type}/${Date.now()}_${file.originalname}`;
    
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      Logger.error('Image upload error', { error: error.message });
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    Logger.error('Image upload error', { error: error.message });
    return null;
  }
};

// Get or create skin profile
const getSkinProfile = async (req, res) => {
  try {
    const { user } = req;
    
    // Get skin profile data from beauty_profiles
    const { data: profile, error } = await supabase
      .from('beauty_profiles')
      .select(`
        skin_type,
        skin_tone,
        undertone,
        primary_skin_concerns,
        secondary_skin_concerns,
        skin_sensitivity_level,
        known_allergies
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Skin profile fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch skin profile'
      });
    }

    // Map to expected format for backward compatibility
    const skinProfile = profile ? {
      skin_type: profile.skin_type,
      skin_tone: profile.skin_tone,
      undertone: profile.undertone,
      primary_concerns: profile.primary_skin_concerns || [],
      secondary_concerns: profile.secondary_skin_concerns || [],
      sensitivity_level: profile.skin_sensitivity_level,
      allergies: profile.known_allergies || []
    } : null;

    res.status(200).json({
      success: true,
      data: skinProfile
    });

  } catch (error) {
    Logger.error('Get skin profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching skin profile'
    });
  }
};

// Update or create skin profile
const updateSkinProfile = async (req, res) => {
  try {
    const { user } = req;
    const profileData = req.body;

    // Map incoming data to beauty_profiles schema
    const beautyProfileData = {
      skin_type: profileData.skin_type,
      skin_tone: profileData.skin_tone,
      undertone: profileData.undertone,
      primary_skin_concerns: profileData.primary_concerns,
      secondary_skin_concerns: profileData.secondary_concerns,
      skin_sensitivity_level: profileData.sensitivity_level,
      known_allergies: profileData.allergies,
      updated_at: new Date().toISOString()
    };

    // Upsert into beauty_profiles
    const { data: result, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        ...beautyProfileData,
        user_id: user.id
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Skin profile update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update skin profile'
      });
    }

    // Update user profile completion status
    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        Logger.info(`Triggering skin AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'skin', 
          result, 
          'skin_profile_update'
        );
      } catch (error) {
        Logger.error('Background AI analysis error', { error: error.message });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Skin profile updated successfully',
      data: result
    });

  } catch (error) {
    Logger.error('Update skin profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating skin profile'
    });
  }
};

// Upload and analyze face photo
const uploadFacePhoto = async (req, res) => {
  try {
    const { user } = req;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Upload image to Supabase Storage
    const imageUrl = await uploadImageToSupabase(req.file, user.id, 'face');
    
    if (!imageUrl) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image'
      });
    }

    // Update beauty profile with photo URL
    const { data: updatedProfile, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        user_id: user.id,
        face_photo_url: imageUrl,
        photo_analysis_consent: true,
        updated_at: new Date().toISOString()
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Face photo update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile with photo'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Face photo uploaded successfully',
      data: {
        imageUrl,
        profile: updatedProfile
      }
    });

  } catch (error) {
    Logger.error('Upload face photo error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while uploading face photo'
    });
  }
};

// Hair Profile Operations
const getHairProfile = async (req, res) => {
  try {
    const { user } = req;

    const { data: profile, error } = await supabase
      .from('beauty_profiles')
      .select(`
        hair_type,
        hair_texture,
        hair_porosity,
        scalp_condition,
        hair_concerns,
        chemical_treatments
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Hair profile fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hair profile'
      });
    }

    // Map to expected format for backward compatibility
    const hairProfile = profile ? {
      hair_type: profile.hair_type,
      hair_texture: profile.hair_texture,
      hair_porosity: profile.hair_porosity,
      scalp_condition: profile.scalp_condition,
      primary_concerns: profile.hair_concerns || [],
      chemical_treatments: profile.chemical_treatments || []
    } : null;

    res.status(200).json({
      success: true,
      data: hairProfile
    });

  } catch (error) {
    Logger.error('Get hair profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching hair profile'
    });
  }
};

const updateHairProfile = async (req, res) => {
  try {
    const { user } = req;
    const profileData = req.body;

    // Map incoming data to beauty_profiles schema
    const beautyProfileData = {
      hair_type: profileData.hair_type,
      hair_texture: profileData.hair_texture,
      hair_porosity: profileData.hair_porosity,
      scalp_condition: profileData.scalp_condition,
      hair_concerns: profileData.primary_concerns,
      chemical_treatments: profileData.chemical_treatments,
      updated_at: new Date().toISOString()
    };

    // Upsert into beauty_profiles
    const { data: result, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        ...beautyProfileData,
        user_id: user.id
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Hair profile update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update hair profile'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        Logger.info(`Triggering hair AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'hair', 
          result, 
          'hair_profile_update'
        );
      } catch (error) {
        Logger.error('Background hair AI analysis error', { error: error.message });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Hair profile updated successfully',
      data: result
    });

  } catch (error) {
    Logger.error('Update hair profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating hair profile'
    });
  }
};

// Lifestyle Demographics Operations
const getLifestyleDemographics = async (req, res) => {
  try {
    const { user } = req;

    const { data: profile, error } = await supabase
      .from('beauty_profiles')
      .select(`
        location_city,
        location_country,
        climate_type,
        pollution_level,
        sun_exposure_daily,
        sleep_hours_avg,
        stress_level,
        exercise_frequency,
        water_intake_daily
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Lifestyle demographics fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch lifestyle demographics'
      });
    }

    // Map to expected format for backward compatibility
    const lifestyleData = profile ? {
      location_city: profile.location_city,
      location_country: profile.location_country,
      climate_type: profile.climate_type,
      pollution_level: profile.pollution_level,
      sun_exposure_daily: profile.sun_exposure_daily,
      sleep_hours_avg: profile.sleep_hours_avg,
      stress_level: profile.stress_level,
      exercise_frequency: profile.exercise_frequency,
      water_intake_daily: profile.water_intake_daily
    } : null;

    res.status(200).json({
      success: true,
      data: lifestyleData
    });

  } catch (error) {
    Logger.error('Get lifestyle demographics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching lifestyle demographics'
    });
  }
};

const updateLifestyleDemographics = async (req, res) => {
  try {
    const { user } = req;
    const profileData = req.body;

    // Map incoming data to beauty_profiles schema
    const beautyProfileData = {
      location_city: profileData.location_city,
      location_country: profileData.location_country,
      climate_type: profileData.climate_type,
      pollution_level: profileData.pollution_level,
      sun_exposure_daily: profileData.sun_exposure_daily,
      sleep_hours_avg: profileData.sleep_hours_avg,
      stress_level: profileData.stress_level,
      exercise_frequency: profileData.exercise_frequency,
      water_intake_daily: profileData.water_intake_daily,
      updated_at: new Date().toISOString()
    };

    // Upsert into beauty_profiles
    const { data: result, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        ...beautyProfileData,
        user_id: user.id
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Lifestyle demographics update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update lifestyle demographics'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        Logger.info(`Triggering lifestyle AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'lifestyle', 
          result, 
          'lifestyle_profile_update'
        );
      } catch (error) {
        Logger.error('Background lifestyle AI analysis error', { error: error.message });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Lifestyle demographics updated successfully',
      data: result
    });

  } catch (error) {
    Logger.error('Update lifestyle demographics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating lifestyle demographics'
    });
  }
};

// Health Medical Conditions Operations
const getHealthMedicalConditions = async (req, res) => {
  try {
    const { user } = req;

    const { data: profile, error } = await supabase
      .from('beauty_profiles')
      .select(`
        age,
        hormonal_status,
        medications,
        skin_medical_conditions,
        dietary_type,
        supplements
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Health medical conditions fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch health medical conditions'
      });
    }

    // Map to expected format for backward compatibility
    const healthData = profile ? {
      age: profile.age,
      hormonal_status: profile.hormonal_status,
      medications: profile.medications || [],
      skin_medical_conditions: profile.skin_medical_conditions || [],
      dietary_type: profile.dietary_type,
      supplements: profile.supplements || []
    } : null;

    res.status(200).json({
      success: true,
      data: healthData
    });

  } catch (error) {
    Logger.error('Get health medical conditions error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching health medical conditions'
    });
  }
};

const updateHealthMedicalConditions = async (req, res) => {
  try {
    const { user } = req;
    const profileData = req.body;

    // Map incoming data to beauty_profiles schema
    const beautyProfileData = {
      age: profileData.age,
      hormonal_status: profileData.hormonal_status,
      medications: profileData.medications,
      skin_medical_conditions: profileData.skin_medical_conditions,
      dietary_type: profileData.dietary_type,
      supplements: profileData.supplements,
      updated_at: new Date().toISOString()
    };

    // Upsert into beauty_profiles
    const { data: result, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        ...beautyProfileData,
        user_id: user.id
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Health medical conditions update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update health medical conditions'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        Logger.info(`Triggering health AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'health', 
          result, 
          'health_profile_update'
        );
      } catch (error) {
        Logger.error('Background health AI analysis error', { error: error.message });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Health medical conditions updated successfully',
      data: result
    });

  } catch (error) {
    Logger.error('Update health medical conditions error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating health medical conditions'
    });
  }
};

// Makeup Preferences Operations
const getMakeupPreferences = async (req, res) => {
  try {
    const { user } = req;

    const { data: profile, error } = await supabase
      .from('beauty_profiles')
      .select(`
        makeup_frequency,
        preferred_look,
        coverage_preference,
        budget_range,
        favorite_brands
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      Logger.error('Makeup preferences fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch makeup preferences'
      });
    }

    // Map to expected format for backward compatibility
    const makeupData = profile ? {
      makeup_frequency: profile.makeup_frequency,
      preferred_look: profile.preferred_look,
      coverage_preference: profile.coverage_preference,
      budget_range: profile.budget_range,
      favorite_brands: profile.favorite_brands || []
    } : null;

    res.status(200).json({
      success: true,
      data: makeupData
    });

  } catch (error) {
    Logger.error('Get makeup preferences error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching makeup preferences'
    });
  }
};

const updateMakeupPreferences = async (req, res) => {
  try {
    const { user } = req;
    const profileData = req.body;

    // Map incoming data to beauty_profiles schema
    const beautyProfileData = {
      makeup_frequency: profileData.makeup_frequency,
      preferred_look: profileData.preferred_look,
      coverage_preference: profileData.coverage_preference,
      budget_range: profileData.budget_range,
      favorite_brands: profileData.favorite_brands,
      updated_at: new Date().toISOString()
    };

    // Upsert into beauty_profiles
    const { data: result, error } = await supabase
      .from('beauty_profiles')
      .upsert([{
        ...beautyProfileData,
        user_id: user.id
      }], { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      Logger.error('Makeup preferences update error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to update makeup preferences'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        Logger.info(`Triggering makeup AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'makeup', 
          result, 
          'makeup_profile_update'
        );
      } catch (error) {
        Logger.error('Background makeup AI analysis error', { error: error.message });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Makeup preferences updated successfully',
      data: result
    });

  } catch (error) {
    Logger.error('Update makeup preferences error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating makeup preferences'
    });
  }
};

// Helper function to update profile completion status
const updateProfileCompletionStatus = async (userId) => {
  try {
    // Get beauty profile
    const { data: profile } = await supabase
      .from('beauty_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return;
    }

    // Check if essential sections are completed
    const skinCompleted = profile.skin_type && profile.skin_tone && profile.primary_skin_concerns;
    const hairCompleted = profile.hair_type && profile.hair_texture && profile.hair_concerns;
    const lifestyleCompleted = profile.location_city && profile.climate_type;
    const healthCompleted = profile.age && profile.hormonal_status;

    const isCompleted = skinCompleted && hairCompleted && lifestyleCompleted && healthCompleted;

    await supabase
      .from('users')
      .update({ profile_completed: isCompleted })
      .eq('id', userId);

  } catch (error) {
    Logger.error('Profile completion update error', { error: error.message });
  }
};

// Get complete profile summary
const getCompleteProfile = async (req, res) => {
  try {
    const { user } = req;

    const { data: userProfile, error } = await supabase
      .from('users')
      .select(`
        id, email, first_name, last_name, phone, date_of_birth, gender, 
        profile_completed, created_at, updated_at
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      Logger.error('Complete profile fetch error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch complete profile'
      });
    }

    // Get beauty profile
    const { data: beautyProfile } = await supabase
      .from('beauty_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Structure response to match old format for backward compatibility
    const completeProfile = {
      ...userProfile,
      beauty_profile: beautyProfile
    };

    res.status(200).json({
      success: true,
      data: completeProfile
    });

  } catch (error) {
    Logger.error('Get complete profile error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching complete profile'
    });
  }
};

module.exports = {
  // Skin Profile
  getSkinProfile,
  updateSkinProfile,
  uploadFacePhoto: [upload.single('face_photo'), uploadFacePhoto],
  
  // Hair Profile
  getHairProfile,
  updateHairProfile,
  
  // Lifestyle Demographics
  getLifestyleDemographics,
  updateLifestyleDemographics,
  
  // Health Medical Conditions
  getHealthMedicalConditions,
  updateHealthMedicalConditions,
  
  // Makeup Preferences
  getMakeupPreferences,
  updateMakeupPreferences,
  
  // Complete Profile
  getCompleteProfile
}; 