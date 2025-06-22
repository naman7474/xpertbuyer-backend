# Beauty AI Platform API Documentation

## Overview

The Beauty AI Platform provides personalized skincare and beauty recommendations based on user profiles and AI-powered photo analysis. This document outlines all available API endpoints for frontend integration.

## Table of Contents

1. [Authentication](#authentication)
2. [Onboarding Flow](#onboarding-flow)
3. [Profile Management](#profile-management)
4. [Photo Upload & Analysis](#photo-upload--analysis)
5. [Beauty Recommendations](#beauty-recommendations)
6. [Progress Tracking](#progress-tracking)
7. [Product Search](#product-search)
8. [Error Handling](#error-handling)

## Authentication

All API endpoints require authentication using a JWT token.

```
Headers:
Authorization: Bearer <JWT_TOKEN>
```

## Onboarding Flow

The onboarding process consists of three main steps:
1. Complete profile forms (required fields)
2. Upload and process photo
3. Generate AI recommendations (automatic)

### Get Onboarding Progress

```http
GET /api/profile/beauty/onboarding
```

**Response:**
```json
{
  "success": true,
  "data": {
    "steps": {
      "profile": {
        "complete": false,
        "percentage": 80,
        "sections": {
          "skin": {
            "total": 6,
            "completed": 6,
            "percentage": 100
          },
          "lifestyle": {
            "total": 7,
            "completed": 5,
            "percentage": 71
          }
        }
      },
      "photo": {
        "uploaded": true,
        "processed": false,
        "status": "processing"
      },
      "recommendations": {
        "generated": false
      }
    },
    "overallProgress": 60,
    "nextStep": "complete_profile"
  }
}
```

## Profile Management

### Profile Fields Configuration

All available profile fields are defined in `src/constants/profileFields.js`. Required fields must be completed for recommendations.

### Update Skin Profile (Required)

```http
PUT /api/profile/beauty/skin
```

**Request Body:**
```json
{
  "skin_type": "combination",          // Required: dry|oily|combination|normal|sensitive
  "skin_tone": "medium",                // Required: fair|light|medium|tan|deep
  "undertone": "warm",                  // Required: warm|cool|neutral
  "primary_concerns": ["acne", "dark_spots"], // Required: array (1-5 items)
  "sensitivity_level": "medium",        // Required: low|medium|high
  "allergies": ["fragrance", "alcohol"] // Optional: array of ingredients to avoid
}
```

**Response:**
```json
{
  "success": true,
  "message": "Skin profile updated successfully",
  "data": { /* updated profile data */ },
  "onboardingStatus": {
    "triggered": false,
    "reason": "profile_incomplete",
    "profileCompletion": 80,
    "missingFields": ["lifestyle.location", "preferences.budget_range"]
  }
}
```

### Update Lifestyle Profile (Required)

```http
PUT /api/profile/beauty/lifestyle
```

**Request Body:**
```json
{
  "location": "Mumbai, India",          // Required
  "climate_type": "humid",              // Required: humid|dry|tropical|temperate|cold|variable
  "pollution_level": "high",            // Required: low|moderate|high|very_high
  "sun_exposure": "moderate",           // Required: minimal|low|moderate|high|very_high
  "sleep_hours": 7,                     // Required: 3-12
  "stress_level": "moderate",           // Required: low|moderate|high|very_high
  "exercise_frequency": "3_times_week", // Required: daily|3_times_week|weekly|rarely|never
  "water_intake": "6-8_glasses"         // Optional
}
```

### Update Hair Profile (Optional)

```http
PUT /api/profile/beauty/hair
```

**Request Body:**
```json
{
  "hair_type": "wavy",                  // straight|wavy|curly|coily
  "hair_texture": "medium",             // fine|medium|thick
  "scalp_condition": "normal",          // dry|oily|normal|flaky|sensitive
  "primary_concerns": ["frizz", "dryness"],
  "chemical_treatments": ["color"],
  "styling_frequency": "weekly"         // daily|weekly|2-3_times_week|rarely|never
}
```

### Update Health Profile (Optional)

```http
PUT /api/profile/beauty/health
```

**Request Body:**
```json
{
  "age": 28,
  "hormonal_status": "normal",          // normal|pregnancy|postpartum|menopause|pcos|thyroid_issues
  "medications": ["vitamin_d"],
  "skin_conditions": ["eczema"],        // eczema|psoriasis|rosacea|dermatitis|vitiligo|none
  "dietary_restrictions": ["vegetarian"]
}
```

### Update Makeup Preferences (Optional)

```http
PUT /api/profile/beauty/makeup
```

**Request Body:**
```json
{
  "makeup_frequency": "daily",          // daily|often|occasionally|rarely|never
  "preferred_look": "natural",          // natural|minimal|glam|bold|professional
  "coverage_preference": "light",       // sheer|light|medium|full
  "budget_range": "3000_5000"          // Required: under_1000|1000_3000|3000_5000|5000_10000|above_10000
}
```

## Photo Upload & Analysis

### Upload Photo

```http
POST /api/photo/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `photo`: Image file (JPEG/PNG, max 10MB)
- `photo_type`: "onboarding" (default) | "progress"

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-photo-id",
    "photo_id": "uuid-photo-id",
    "processing_status": "started",
    "estimated_time": 30
  }
}
```

### Check Photo Processing Status

```http
GET /api/photo/status/:session_id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",              // pending|processing|completed|failed
    "face_model_url": "https://...",    // 3D face model URL (when completed)
    "face_landmarks": [...],            // Face landmark coordinates
    "processing_time": 25000,           // Processing time in ms
    "analysis": {
      "skin_concerns": [
        {
          "type": "acne",
          "severity": "mild",
          "locations": ["forehead", "chin"],
          "confidence": 0.9
        }
      ],
      "skin_attributes": {
        "tone": "medium",
        "undertone": "warm",
        "texture": "normal",
        "age_appearance": 25
      },
      "overall_skin_score": 75,
      "ai_observations": ["Mild acne on T-zone", "Good hydration levels"],
      "positive_attributes": ["Even skin tone", "Healthy glow"]
    }
  }
}
```

## Beauty Recommendations

### Get Personalized Recommendations

Recommendations are automatically generated when both profile and photo analysis are complete.

```http
GET /api/recommendations/beauty
```

**Response:**
```json
{
  "success": true,
  "data": {
    "routine": {
      "morning": [
        {
          "step": 1,
          "product_type": "cleanser",
          "product_id": "prod_123",
          "product_name": "Gentle Foaming Cleanser",
          "brand": "CeraVe",
          "price": 499,
          "key_ingredients": ["salicylic_acid", "niacinamide"],
          "recommendation_reason": "Helps control acne without over-drying",
          "usage_instructions": "Apply to damp face, massage gently, rinse",
          "expected_results": "Clearer skin in 2-4 weeks",
          "face_coordinates": {
            "markers": [
              {"x": 0.5, "y": 0.5, "z": 0.1, "type": "primary"}
            ],
            "highlight_regions": ["full_face"]
          }
        },
        // ... more morning products
      ],
      "evening": [
        // ... evening routine products
      ],
      "weekly": [
        // ... weekly treatment products
      ]
    },
    "targeted_treatments": [
      {
        "concern": "acne",
        "product_type": "spot_treatment",
        "key_ingredients": ["benzoyl_peroxide"],
        "application_zones": {
          "forehead": {"x": 0.5, "y": 0.8, "z": 0.15, "radius": 0.2},
          "chin": {"x": 0.5, "y": 0.2, "z": 0.14, "radius": 0.12}
        },
        "frequency": "as_needed"
      }
    ],
    "ai_insights": {
      "primary_focus": "Acne control and prevention",
      "routine_philosophy": "Simple, effective routine focusing on gentle actives",
      "expected_timeline": "Visible improvements in 4-6 weeks",
      "lifestyle_tips": [
        "Increase water intake to 8 glasses daily",
        "Consider oil-free sunscreen for humid climate"
      ]
    }
  }
}
```

### Submit Product Feedback

```http
POST /api/recommendations/feedback
```

**Request Body:**
```json
{
  "recommendation_id": "rec_123",
  "product_id": "prod_123",
  "feedback_type": "positive",          // positive|negative|neutral
  "rating": 5,                          // 1-5
  "comments": "Great product, seeing improvements!"
}
```

## Progress Tracking

### Upload Progress Photo

```http
POST /api/progress/photo
Content-Type: multipart/form-data
```

**Form Data:**
- `photo`: Image file
- `week_number`: Week number (e.g., "4")

### Get Progress Timeline

```http
GET /api/progress/timeline
```

**Response:**
```json
{
  "success": true,
  "data": {
    "baseline": {
      "date": "2024-01-01",
      "skin_score": 65,
      "main_concerns": ["acne", "texture"]
    },
    "progress": [
      {
        "week": 4,
        "date": "2024-01-29",
        "skin_score": 72,
        "improvements": ["Reduced acne", "Smoother texture"],
        "comparison_url": "https://..."
      }
    ],
    "ai_analysis": {
      "overall_improvement": 10.8,
      "concern_progress": {
        "acne": {"improvement": 25, "status": "improving"},
        "texture": {"improvement": 15, "status": "improving"}
      }
    }
  }
}
```

## Product Search

### Search Products with Beauty Context

```http
POST /api/search
```

**Request Body:**
```json
{
  "query": "moisturizer for acne prone skin",
  "includeIngredients": true
}
```

**Response:**
```json
{
  "query": "moisturizer for acne prone skin",
  "parsedQuery": {
    "type": "moisturizer",
    "concern": "acne",
    "userContext": {
      "skinType": "combination",
      "avoidIngredients": ["fragrance"]
    }
  },
  "products": [
    {
      "id": "prod_123",
      "brand": "La Roche-Posay",
      "name": "Effaclar Mat Moisturizer",
      "price": {
        "mrp": 1590,
        "sale": 1350,
        "currency": "INR"
      },
      "rating": {
        "average": 4.3,
        "count": 234
      },
      "matchReason": "Oil-free formula perfect for acne-prone combination skin",
      "ingredients": [
        {
          "name": "Sebulyse",
          "benefits": "Controls oil production"
        }
      ]
    }
  ],
  "ingredients": [
    {
      "ingredient": "Niacinamide",
      "highlight": "Reduces acne and controls oil"
    }
  ],
  "beauty_context_applied": true,
  "personalization": {
    "isPersonalized": true,
    "skinType": "combination",
    "primaryConcerns": ["acne"],
    "avoidedIngredients": ["fragrance"]
  }
}
```

## Error Handling

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `AUTH_REQUIRED`: Authentication token missing
- `AUTH_INVALID`: Invalid or expired token
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `PROFILE_INCOMPLETE`: Profile missing required fields
- `PHOTO_REQUIRED`: Photo upload required
- `PROCESSING`: Resource still processing
- `SERVER_ERROR`: Internal server error

## Implementation Notes

1. **Automatic Recommendations**: After completing required profile fields and photo upload, recommendations are generated automatically. No manual trigger needed.

2. **Profile Persistence**: All profile updates are persisted immediately. Frontend can save drafts locally but should sync with backend regularly.

3. **Photo Requirements**: 
   - Minimum resolution: 640x640
   - Maximum file size: 10MB
   - Supported formats: JPEG, PNG
   - Face should be clearly visible

4. **Real-time Updates**: Use the status endpoints to poll for photo processing completion. Typical processing time is 20-40 seconds.

5. **Caching**: Recommendations are cached for 7 days. Force refresh by uploading a new photo.

## Rate Limits

- Photo uploads: 10 per hour per user
- API calls: 1000 per hour per user
- Search queries: 100 per hour per user

## Support

For API support or issues, contact: api-support@xpertbuyer.com 