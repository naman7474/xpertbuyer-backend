const supabase = require('../config/database');
const multer = require('multer');
const path = require('path');
const aiAnalysisService = require('../services/aiAnalysisService');

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
      console.error('Image upload error:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    return null;
  }
};

// Get or create skin profile
const getSkinProfile = async (req, res) => {
  try {
    const { user } = req;

    const { data: skinProfile, error } = await supabase
      .from('skin_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Skin profile fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch skin profile'
      });
    }

    res.status(200).json({
      success: true,
      data: skinProfile || null
    });

  } catch (error) {
    console.error('Get skin profile error:', error);
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

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('skin_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (existingProfile) {
      // Update existing profile
      result = await supabase
        .from('skin_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
    } else {
      // Create new profile
      result = await supabase
        .from('skin_profiles')
        .insert([{
          ...profileData,
          user_id: user.id
        }])
        .select('*')
        .single();
    }

    if (result.error) {
      console.error('Skin profile update error:', result.error);
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
        console.log(`🤖 Triggering skin AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'skin', 
          result.data, 
          'skin_profile_update'
        );
      } catch (error) {
        console.error('Background AI analysis error:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Skin profile updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Update skin profile error:', error);
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

    // Update skin profile with photo URL
    const { data: updatedProfile, error } = await supabase
      .from('skin_profiles')
      .upsert([{
        user_id: user.id,
        face_photo_url: imageUrl,
        photo_analysis_consent: true,
        updated_at: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (error) {
      console.error('Face photo update error:', error);
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
    console.error('Upload face photo error:', error);
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

    const { data: hairProfile, error } = await supabase
      .from('hair_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Hair profile fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hair profile'
      });
    }

    res.status(200).json({
      success: true,
      data: hairProfile || null
    });

  } catch (error) {
    console.error('Get hair profile error:', error);
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

    const { data: existingProfile } = await supabase
      .from('hair_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (existingProfile) {
      result = await supabase
        .from('hair_profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('hair_profiles')
        .insert([{
          ...profileData,
          user_id: user.id
        }])
        .select('*')
        .single();
    }

    if (result.error) {
      console.error('Hair profile update error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update hair profile'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🤖 Triggering hair AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'hair', 
          result.data, 
          'hair_profile_update'
        );
      } catch (error) {
        console.error('Background hair AI analysis error:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Hair profile updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Update hair profile error:', error);
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

    const { data: lifestyleData, error } = await supabase
      .from('lifestyle_demographics')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Lifestyle demographics fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch lifestyle demographics'
      });
    }

    res.status(200).json({
      success: true,
      data: lifestyleData || null
    });

  } catch (error) {
    console.error('Get lifestyle demographics error:', error);
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

    const { data: existingProfile } = await supabase
      .from('lifestyle_demographics')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (existingProfile) {
      result = await supabase
        .from('lifestyle_demographics')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('lifestyle_demographics')
        .insert([{
          ...profileData,
          user_id: user.id
        }])
        .select('*')
        .single();
    }

    if (result.error) {
      console.error('Lifestyle demographics update error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update lifestyle demographics'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🤖 Triggering lifestyle AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'lifestyle', 
          result.data, 
          'lifestyle_profile_update'
        );
      } catch (error) {
        console.error('Background lifestyle AI analysis error:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Lifestyle demographics updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Update lifestyle demographics error:', error);
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

    const { data: healthData, error } = await supabase
      .from('health_medical_conditions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Health medical conditions fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch health medical conditions'
      });
    }

    res.status(200).json({
      success: true,
      data: healthData || null
    });

  } catch (error) {
    console.error('Get health medical conditions error:', error);
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

    const { data: existingProfile } = await supabase
      .from('health_medical_conditions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (existingProfile) {
      result = await supabase
        .from('health_medical_conditions')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('health_medical_conditions')
        .insert([{
          ...profileData,
          user_id: user.id
        }])
        .select('*')
        .single();
    }

    if (result.error) {
      console.error('Health medical conditions update error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update health medical conditions'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🤖 Triggering health AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'health', 
          result.data, 
          'health_profile_update'
        );
      } catch (error) {
        console.error('Background health AI analysis error:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Health medical conditions updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Update health medical conditions error:', error);
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

    const { data: makeupData, error } = await supabase
      .from('makeup_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Makeup preferences fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch makeup preferences'
      });
    }

    res.status(200).json({
      success: true,
      data: makeupData || null
    });

  } catch (error) {
    console.error('Get makeup preferences error:', error);
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

    const { data: existingProfile } = await supabase
      .from('makeup_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (existingProfile) {
      result = await supabase
        .from('makeup_preferences')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
    } else {
      result = await supabase
        .from('makeup_preferences')
        .insert([{
          ...profileData,
          user_id: user.id
        }])
        .select('*')
        .single();
    }

    if (result.error) {
      console.error('Makeup preferences update error:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update makeup preferences'
      });
    }

    await updateProfileCompletionStatus(user.id);

    // Trigger AI analysis in the background (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🤖 Triggering makeup AI analysis for user ${user.id}`);
        await aiAnalysisService.analyzeProfileData(
          user.id, 
          'makeup', 
          result.data, 
          'makeup_profile_update'
        );
      } catch (error) {
        console.error('Background makeup AI analysis error:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Makeup preferences updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Update makeup preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating makeup preferences'
    });
  }
};

// Helper function to update profile completion status
const updateProfileCompletionStatus = async (userId) => {
  try {
    // Check if all essential profile sections are completed
    const [skinProfile, hairProfile, lifestyleData, healthData] = await Promise.all([
      supabase.from('skin_profiles').select('id').eq('user_id', userId).single(),
      supabase.from('hair_profiles').select('id').eq('user_id', userId).single(),
      supabase.from('lifestyle_demographics').select('id').eq('user_id', userId).single(),
      supabase.from('health_medical_conditions').select('id').eq('user_id', userId).single()
    ]);

    const isCompleted = !skinProfile.error && !hairProfile.error && 
                      !lifestyleData.error && !healthData.error;

    await supabase
      .from('users')
      .update({ profile_completed: isCompleted })
      .eq('id', userId);

  } catch (error) {
    console.error('Profile completion update error:', error);
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
        profile_completed, created_at, updated_at,
        skin_profiles(*),
        hair_profiles(*),
        lifestyle_demographics(*),
        health_medical_conditions(*),
        makeup_preferences(*)
      `)
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Complete profile fetch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch complete profile'
      });
    }

    res.status(200).json({
      success: true,
      data: userProfile
    });

  } catch (error) {
    console.error('Get complete profile error:', error);
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