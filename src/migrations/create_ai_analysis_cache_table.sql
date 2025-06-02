-- Migration: Create AI Analysis Cache Table
-- Description: Create table to cache AI analysis results to reduce redundant API calls

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  analysis_type VARCHAR(100) NOT NULL,
  profile_data_hash VARCHAR(32) NOT NULL,
  analysis_result JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  access_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_type ON ai_analysis_cache(user_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_id ON ai_analysis_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created_at ON ai_analysis_cache(created_at);

-- Add comments for documentation
COMMENT ON TABLE ai_analysis_cache IS 'Cache table for AI analysis results to reduce redundant API calls';
COMMENT ON COLUMN ai_analysis_cache.cache_key IS 'Unique key combining user_id, analysis_type, and profile_data_hash';
COMMENT ON COLUMN ai_analysis_cache.user_id IS 'References the user who owns this cached analysis';
COMMENT ON COLUMN ai_analysis_cache.analysis_type IS 'Type of analysis (skin, hair, lifestyle, health, makeup, comprehensive)';
COMMENT ON COLUMN ai_analysis_cache.profile_data_hash IS 'MD5 hash of the profile data used for this analysis';
COMMENT ON COLUMN ai_analysis_cache.analysis_result IS 'JSON result from AI analysis';
COMMENT ON COLUMN ai_analysis_cache.expires_at IS 'When this cache entry expires';
COMMENT ON COLUMN ai_analysis_cache.access_count IS 'Number of times this cache entry has been accessed';
COMMENT ON COLUMN ai_analysis_cache.last_accessed_at IS 'Last time this cache entry was accessed'; 