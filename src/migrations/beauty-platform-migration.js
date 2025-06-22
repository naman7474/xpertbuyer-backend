// scripts/migrations/beauty-platform-migration.js
const { createClient } = require('@supabase/supabase-js');
const Logger = require('../../src/utils/logger');
require('dotenv').config();

class BeautyPlatformMigration {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY // Use service key for migrations
    );
    
    this.migrationSteps = [
      this.createBeautyTables,
      this.addBeautyIndexes,
      this.createBeautyFunctions,
      this.setupRLS,
      this.migrateExistingData,
      this.createTriggers,
      this.seedInitialData
    ];
  }

  /**
   * Run all migrations
   */
  async run() {
    Logger.info('Starting Beauty Platform migration...');
    
    try {
      for (let i = 0; i < this.migrationSteps.length; i++) {
        const step = this.migrationSteps[i];
        Logger.info(`Running migration step ${i + 1}/${this.migrationSteps.length}: ${step.name}`);
        await step.call(this);
        Logger.info(`Completed step ${i + 1}`);
      }
      
      Logger.info('Beauty Platform migration completed successfully!');
    } catch (error) {
      Logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create beauty-specific tables
   */
  async createBeautyTables() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql_query: `
        -- Check if tables exist before creating
        DO $$ 
        BEGIN
          -- User profiles extension
          IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_profiles') THEN
            CREATE TABLE user_profiles (
              id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
              profile_photo_url TEXT,
              onboarding_completed BOOLEAN DEFAULT FALSE,
              onboarding_step TEXT DEFAULT 'photo_upload',
              profile_completeness INTEGER DEFAULT 0,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          END IF;

          -- Beauty profiles (comprehensive)
          IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'beauty_profiles') THEN
            CREATE TABLE beauty_profiles (
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
              
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              
              UNIQUE(user_id)
            );
          END IF;

          -- Photo uploads table
          IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'photo_uploads') THEN
            CREATE TABLE photo_uploads (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
              photo_url TEXT NOT NULL,
              photo_type TEXT CHECK (photo_type IN ('onboarding', 'progress', 'comparison')),
              week_number INTEGER,
              
              -- 3D Face Model
              face_model_url TEXT,
              face_landmarks JSONB,
              face_mesh_data JSONB,
              processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
              processing_time_ms INTEGER,
              
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
          END IF;

          -- Continue with other tables...
          -- (Rest of the tables from the schema artifact)
        END $$;
      `
    });

    if (error) throw error;
  }

  /**
   * Add indexes for performance
   */
  async addBeautyIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_beauty_profiles_user_id ON beauty_profiles(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_photo_uploads_user_id ON photo_uploads(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_photo_uploads_status ON photo_uploads(processing_status)',
      'CREATE INDEX IF NOT EXISTS idx_photo_analyses_user_id ON photo_analyses(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_product_recommendations_user_id ON product_recommendations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_progress_user_id_week ON user_progress(user_id, week_number)',
      'CREATE INDEX IF NOT EXISTS idx_routine_tracking_user_date ON routine_tracking(user_id, date)',
      
      // Composite indexes for common queries
      'CREATE INDEX IF NOT EXISTS idx_recommendations_user_routine ON product_recommendations(user_id, routine_time, routine_step)',
      'CREATE INDEX IF NOT EXISTS idx_progress_user_created ON user_progress(user_id, created_at DESC)'
    ];

    for (const indexSql of indexes) {
      const { error } = await this.supabase.rpc('exec_sql', { sql_query: indexSql });
      if (error) {
        Logger.warn(`Index creation warning: ${error.message}`);
      }
    }
  }

  /**
   * Create database functions
   */
  async createBeautyFunctions() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql_query: `
        -- Function to calculate profile completeness
        CREATE OR REPLACE FUNCTION calculate_profile_completeness(p_user_id UUID)
        RETURNS INTEGER AS $$
        DECLARE
          v_completeness INTEGER := 0;
          v_profile beauty_profiles%ROWTYPE;
        BEGIN
          SELECT * INTO v_profile FROM beauty_profiles WHERE user_id = p_user_id;
          
          IF NOT FOUND THEN
            RETURN 0;
          END IF;
          
          -- Check each section (20% each)
          IF v_profile.skin_type IS NOT NULL AND array_length(v_profile.primary_skin_concerns, 1) > 0 THEN
            v_completeness := v_completeness + 20;
          END IF;
          
          IF v_profile.hair_type IS NOT NULL AND array_length(v_profile.hair_concerns, 1) > 0 THEN
            v_completeness := v_completeness + 20;
          END IF;
          
          IF v_profile.location_city IS NOT NULL AND v_profile.climate_type IS NOT NULL THEN
            v_completeness := v_completeness + 20;
          END IF;
          
          IF v_profile.age IS NOT NULL AND v_profile.hormonal_status IS NOT NULL THEN
            v_completeness := v_completeness + 20;
          END IF;
          
          IF v_profile.makeup_frequency IS NOT NULL AND v_profile.preferred_look IS NOT NULL THEN
            v_completeness := v_completeness + 20;
          END IF;
          
          RETURN v_completeness;
        END;
        $$ LANGUAGE plpgsql;

        -- Function to get user's skin improvement percentage
        CREATE OR REPLACE FUNCTION get_skin_improvement(p_user_id UUID, p_weeks INTEGER DEFAULT 4)
        RETURNS DECIMAL AS $$
        DECLARE
          v_baseline_score INTEGER;
          v_latest_score INTEGER;
        BEGIN
          -- Get baseline score
          SELECT overall_skin_score INTO v_baseline_score
          FROM photo_analyses pa
          JOIN photo_uploads pu ON pa.photo_id = pu.id
          WHERE pa.user_id = p_user_id
          ORDER BY pa.created_at ASC
          LIMIT 1;
          
          -- Get latest score
          SELECT overall_skin_score INTO v_latest_score
          FROM photo_analyses pa
          JOIN photo_uploads pu ON pa.photo_id = pu.id
          WHERE pa.user_id = p_user_id
            AND pa.created_at >= NOW() - INTERVAL '1 week' * p_weeks
          ORDER BY pa.created_at DESC
          LIMIT 1;
          
          IF v_baseline_score IS NULL OR v_latest_score IS NULL THEN
            RETURN 0;
          END IF;
          
          RETURN ((v_latest_score - v_baseline_score)::DECIMAL / v_baseline_score) * 100;
        END;
        $$ LANGUAGE plpgsql;

        -- Function to get routine adherence rate
        CREATE OR REPLACE FUNCTION get_routine_adherence(p_user_id UUID, p_days INTEGER DEFAULT 30)
        RETURNS INTEGER AS $$
        DECLARE
          v_tracked_days INTEGER;
          v_completed_days INTEGER;
        BEGIN
          SELECT COUNT(*) INTO v_tracked_days
          FROM routine_tracking
          WHERE user_id = p_user_id
            AND date >= CURRENT_DATE - p_days;
          
          SELECT COUNT(*) INTO v_completed_days
          FROM routine_tracking
          WHERE user_id = p_user_id
            AND date >= CURRENT_DATE - p_days
            AND (morning_completed = TRUE OR evening_completed = TRUE);
          
          IF v_tracked_days = 0 THEN
            RETURN 0;
          END IF;
          
          RETURN (v_completed_days::DECIMAL / p_days * 100)::INTEGER;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    if (error) throw error;
  }

  /**
   * Setup Row Level Security
   */
  async setupRLS() {
    const tables = [
      'user_profiles',
      'beauty_profiles', 
      'photo_uploads',
      'photo_analyses',
      'product_recommendations',
      'user_progress',
      'routine_tracking'
    ];

    for (const table of tables) {
      // Enable RLS
      await this.supabase.rpc('exec_sql', {
        sql_query: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`
      });

      // Create policies
      const policies = this.getRLSPolicies(table);
      for (const policy of policies) {
        const { error } = await this.supabase.rpc('exec_sql', { sql_query: policy });
        if (error) {
          Logger.warn(`RLS policy warning for ${table}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get RLS policies for a table
   */
  getRLSPolicies(table) {
    const policies = [];
    
    // User can view own data
    policies.push(`
      CREATE POLICY IF NOT EXISTS "${table}_select_own" ON ${table}
      FOR SELECT USING (
        ${table === 'user_profiles' ? 'id' : 'user_id'} = auth.uid()
      )
    `);

    // User can insert own data (except photo_analyses)
    if (table !== 'photo_analyses') {
      policies.push(`
        CREATE POLICY IF NOT EXISTS "${table}_insert_own" ON ${table}
        FOR INSERT WITH CHECK (
          ${table === 'user_profiles' ? 'id' : 'user_id'} = auth.uid()
        )
      `);
    }

    // User can update own data
    policies.push(`
      CREATE POLICY IF NOT EXISTS "${table}_update_own" ON ${table}
      FOR UPDATE USING (
        ${table === 'user_profiles' ? 'id' : 'user_id'} = auth.uid()
      )
    `);

    // User can delete own data (only for specific tables)
    if (['photo_uploads', 'routine_tracking'].includes(table)) {
      policies.push(`
        CREATE POLICY IF NOT EXISTS "${table}_delete_own" ON ${table}
        FOR DELETE USING (user_id = auth.uid())
      `);
    }

    return policies;
  }

  /**
   * Migrate existing user data
   */
  async migrateExistingData() {
    Logger.info('Migrating existing user data...');

    // Get all users with existing profiles
    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('id, skin_profiles(*), hair_profiles(*), lifestyle_demographics(*), health_medical_conditions(*), makeup_preferences(*)');

    if (usersError) {
      Logger.warn('No existing user data to migrate');
      return;
    }

    for (const user of users) {
      try {
        // Merge old profile tables into new beauty_profiles
        const beautyProfile = {
          user_id: user.id,
          // Map skin profile
          skin_type: user.skin_profiles?.[0]?.skin_type,
          skin_tone: user.skin_profiles?.[0]?.skin_tone,
          undertone: user.skin_profiles?.[0]?.undertone,
          primary_skin_concerns: user.skin_profiles?.[0]?.primary_concerns,
          known_allergies: user.skin_profiles?.[0]?.known_allergies,
          
          // Map hair profile
          hair_type: user.hair_profiles?.[0]?.hair_type,
          hair_texture: user.hair_profiles?.[0]?.hair_texture,
          scalp_condition: user.hair_profiles?.[0]?.scalp_condition,
          hair_concerns: user.hair_profiles?.[0]?.primary_concerns,
          
          // Map lifestyle
          location_city: user.lifestyle_demographics?.[0]?.location_city,
          climate_type: user.lifestyle_demographics?.[0]?.climate_type,
          stress_level: user.lifestyle_demographics?.[0]?.stress_level,
          
          // Map health
          hormonal_status: user.health_medical_conditions?.[0]?.hormonal_status,
          skin_medical_conditions: user.health_medical_conditions?.[0]?.skin_conditions,
          
          // Map makeup
          makeup_frequency: user.makeup_preferences?.[0]?.makeup_frequency,
          preferred_look: user.makeup_preferences?.[0]?.makeup_style,
          budget_range: user.makeup_preferences?.[0]?.price_range_preference
        };

        // Insert into new table
        await this.supabase
          .from('beauty_profiles')
          .upsert(beautyProfile, { onConflict: 'user_id' });

        Logger.debug(`Migrated data for user ${user.id}`);

      } catch (error) {
        Logger.error(`Failed to migrate user ${user.id}`, { error: error.message });
      }
    }
  }

  /**
   * Create triggers for automated updates
   */
  async createTriggers() {
    const { error } = await this.supabase.rpc('exec_sql', {
      sql_query: `
        -- Trigger to update profile completeness
        CREATE OR REPLACE FUNCTION update_profile_completeness()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE user_profiles
          SET profile_completeness = calculate_profile_completeness(NEW.user_id),
              updated_at = NOW()
          WHERE id = NEW.user_id;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_update_profile_completeness
        AFTER INSERT OR UPDATE ON beauty_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_profile_completeness();

        -- Trigger to update timestamps
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Apply to all tables with updated_at
        CREATE TRIGGER trigger_update_timestamp_user_profiles
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();

        CREATE TRIGGER trigger_update_timestamp_beauty_profiles
        BEFORE UPDATE ON beauty_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at();
      `
    });

    if (error) throw error;
  }

  /**
   * Seed initial data
   */
  async seedInitialData() {
    Logger.info('Seeding initial beauty data...');

    // Add default skin concerns
    const skinConcerns = [
      'acne', 'dark_spots', 'wrinkles', 'fine_lines', 'blackheads',
      'large_pores', 'dullness', 'uneven_texture', 'redness', 'dryness',
      'oiliness', 'sensitivity', 'dark_circles', 'puffiness'
    ];

    // Add default allergens
    const commonAllergens = [
      'fragrance', 'alcohol', 'essential_oils', 'sulfates', 'parabens',
      'formaldehyde', 'mineral_oil', 'phthalates', 'retinol', 'acids'
    ];

    // Store as configuration (optional)
    await this.supabase
      .from('app_configurations')
      .upsert({
        key: 'beauty_defaults',
        value: {
          skin_concerns: skinConcerns,
          common_allergens: commonAllergens,
          routine_steps: {
            morning: ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen'],
            evening: ['cleanser', 'toner', 'treatment', 'serum', 'moisturizer', 'eye_cream']
          }
        }
      }, { onConflict: 'key' });

    Logger.info('Initial data seeded successfully');
  }

  /**
   * Rollback function
   */
  async rollback() {
    Logger.warn('Rolling back Beauty Platform migration...');

    const tables = [
      'routine_tracking',
      'user_progress',
      'product_recommendations',
      'photo_analyses',
      'photo_uploads',
      'beauty_profiles',
      'user_profiles'
    ];

    for (const table of tables) {
      const { error } = await this.supabase.rpc('exec_sql', {
        sql_query: `DROP TABLE IF EXISTS ${table} CASCADE`
      });
      
      if (error) {
        Logger.error(`Failed to drop table ${table}`, { error: error.message });
      }
    }

    Logger.info('Rollback completed');
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new BeautyPlatformMigration();
  
  const command = process.argv[2];
  
  if (command === 'rollback') {
    migration.rollback()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    migration.run()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = BeautyPlatformMigration;