-- Beauty AI Platform - Onboarding Updates Migration
-- This migration adds necessary columns for the enhanced onboarding flow

-- Add onboarding tracking columns to beauty_profiles table
ALTER TABLE beauty_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recommendations_generated BOOLEAN DEFAULT FALSE;

-- Add product details to product_recommendations table
ALTER TABLE product_recommendations
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS brand_name TEXT,
ADD COLUMN IF NOT EXISTS price_mrp DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS match_reason TEXT,
ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3, 2);

-- Create index for faster recommendation queries
CREATE INDEX IF NOT EXISTS idx_product_recommendations_user_analysis 
ON product_recommendations(user_id, analysis_id);

-- Create index for onboarding status checks
CREATE INDEX IF NOT EXISTS idx_beauty_profiles_onboarding 
ON beauty_profiles(user_id, recommendations_generated);

-- Add created_at to product_recommendations if not exists
ALTER TABLE product_recommendations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing recommendations to have created_at
UPDATE product_recommendations 
SET created_at = NOW() 
WHERE created_at IS NULL; 