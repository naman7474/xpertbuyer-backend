-- Create beauty_profiles table manually
-- This script creates the table that the controllers expect

CREATE TABLE IF NOT EXISTS beauty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Skin Profile
  skin_type TEXT CHECK (skin_type IN ('dry', 'oily', 'combination', 'normal', 'sensitive')),
  skin_tone TEXT CHECK (skin_tone IN ('fair', 'light', 'medium', 'tan', 'deep')),
  undertone TEXT CHECK (undertone IN ('warm', 'cool', 'neutral')),
  primary_skin_concerns TEXT[],
  secondary_skin_concerns TEXT[],
  skin_sensitivity_level TEXT CHECK (skin_sensitivity_level IN ('low', 'medium', 'high')),
  known_allergies TEXT[],
  
  -- Hair Profile
  hair_type TEXT CHECK (hair_type IN ('straight', 'wavy', 'curly', 'coily')),
  hair_texture TEXT CHECK (hair_texture IN ('fine', 'medium', 'thick')),
  hair_porosity TEXT CHECK (hair_porosity IN ('low', 'medium', 'high')),
  scalp_condition TEXT CHECK (scalp_condition IN ('dry', 'oily', 'normal', 'sensitive')),
  hair_concerns TEXT[],
  chemical_treatments TEXT[],
  
  -- Lifestyle Demographics
  location_city TEXT,
  location_country TEXT,
  climate_type TEXT CHECK (climate_type IN ('tropical', 'dry', 'temperate', 'continental', 'polar')),
  pollution_level TEXT CHECK (pollution_level IN ('low', 'moderate', 'high', 'severe')),
  sun_exposure_daily TEXT CHECK (sun_exposure_daily IN ('minimal', 'low', 'moderate', 'high')),
  sleep_hours_avg DECIMAL(3,1),
  stress_level TEXT CHECK (stress_level IN ('low', 'moderate', 'high', 'severe')),
  exercise_frequency TEXT CHECK (exercise_frequency IN ('never', 'rarely', 'weekly', '3_times_week', 'daily')),
  water_intake_daily INTEGER,
  
  -- Health & Medical
  age INTEGER,
  hormonal_status TEXT CHECK (hormonal_status IN ('normal', 'pregnancy', 'breastfeeding', 'menopause', 'pcos', 'thyroid')),
  medications TEXT[],
  skin_medical_conditions TEXT[],
  dietary_type TEXT CHECK (dietary_type IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian')),
  supplements TEXT[],
  
  -- Makeup Preferences
  makeup_frequency TEXT CHECK (makeup_frequency IN ('never', 'special_occasions', 'weekly', 'daily', 'multiple_daily')),
  preferred_look TEXT CHECK (preferred_look IN ('natural', 'professional', 'glam', 'dramatic', 'artistic')),
  coverage_preference TEXT CHECK (coverage_preference IN ('none', 'light', 'medium', 'full')),
  budget_range TEXT CHECK (budget_range IN ('budget', 'mid_range', 'luxury', 'mixed')),
  favorite_brands TEXT[],
  
  -- Onboarding tracking (from the updates migration)
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  recommendations_generated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beauty_profiles_user_id ON beauty_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_profiles_onboarding ON beauty_profiles(user_id, recommendations_generated);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp_beauty_profiles
BEFORE UPDATE ON beauty_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at(); 