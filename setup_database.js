// setup_database.js - Script to create the beauty_profiles table
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function setupDatabase() {
  console.log('Setting up database tables...');
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('./create_beauty_profiles_table.sql', 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.error('Error creating table:', error);
    } else {
      console.log('✅ Beauty profiles table created successfully!');
    }
    
    // Also create the ai_analysis_cache table
    const cacheTableSql = `
      CREATE TABLE IF NOT EXISTS ai_analysis_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key TEXT UNIQUE NOT NULL,
        cache_data JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_key ON ai_analysis_cache(cache_key);
      CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_expires ON ai_analysis_cache(expires_at);
    `;
    
    const { error: cacheError } = await supabase.rpc('exec_sql', {
      sql_query: cacheTableSql
    });
    
    if (cacheError) {
      console.error('Error creating cache table:', cacheError);
    } else {
      console.log('✅ AI analysis cache table created successfully!');
    }
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupDatabase(); 