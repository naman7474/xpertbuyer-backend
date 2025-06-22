// setup_database_simple.js - Create tables using direct SQL
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function createBeautyProfilesTable() {
  console.log('Creating beauty_profiles table...');
  
  // First, let's check if the table exists
  const { data: tables, error: checkError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_name', 'beauty_profiles');
    
  if (checkError) {
    console.log('Cannot check existing tables, will try to create...');
  } else if (tables && tables.length > 0) {
    console.log('✅ beauty_profiles table already exists');
    return true;
  }
  
  try {
    // Since we can't execute DDL directly, let's try creating a minimal record first
    // This will fail if the table doesn't exist, then we know we need to create it
    
    const testQuery = await supabase
      .from('beauty_profiles')
      .select('id')
      .limit(1);
      
    if (testQuery.error && testQuery.error.message.includes('does not exist')) {
      console.log('❌ Table does not exist. Please run the SQL manually in your Supabase dashboard:');
      console.log('');
      console.log('Copy and paste this SQL in your Supabase SQL Editor:');
      console.log('');
      console.log(`
CREATE TABLE IF NOT EXISTS beauty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Skin Profile
  skin_type TEXT,
  skin_tone TEXT,
  undertone TEXT,
  primary_skin_concerns TEXT[],
  secondary_skin_concerns TEXT[],
  skin_sensitivity_level TEXT,
  known_allergies TEXT[],
  
  -- Hair Profile  
  hair_type TEXT,
  hair_texture TEXT,
  hair_porosity TEXT,
  scalp_condition TEXT,
  hair_concerns TEXT[],
  chemical_treatments TEXT[],
  
  -- Lifestyle Demographics
  location_city TEXT,
  location_country TEXT,
  climate_type TEXT,
  pollution_level TEXT,
  sun_exposure_daily TEXT,
  sleep_hours_avg DECIMAL(3,1),
  stress_level TEXT,
  exercise_frequency TEXT,
  water_intake_daily INTEGER,
  
  -- Health & Medical
  age INTEGER,
  hormonal_status TEXT,
  medications TEXT[],
  skin_medical_conditions TEXT[],
  dietary_type TEXT,
  supplements TEXT[],
  
  -- Makeup Preferences
  makeup_frequency TEXT,
  preferred_look TEXT,
  coverage_preference TEXT,
  budget_range TEXT,
  favorite_brands TEXT[],
  
  -- Onboarding tracking
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  recommendations_generated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create the cache table
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  cache_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
      console.log('');
      console.log('After running this SQL, restart the server with: npm start');
      return false;
    } else {
      console.log('✅ beauty_profiles table exists and is accessible');
      return true;
    }
    
  } catch (error) {
    console.error('Error checking table:', error);
    return false;
  }
}

createBeautyProfilesTable(); 