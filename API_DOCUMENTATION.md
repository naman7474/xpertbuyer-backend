# XpertBuyer Backend API Documentation

## Overview
This API provides comprehensive user authentication and detailed skin profiling functionality for personalized skincare product recommendations.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+919876543210",
  "date_of_birth": "1990-01-01",
  "gender": "male"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2023-01-01T00:00:00Z"
    },
    "token": "jwt_token_here",
    "expires_at": "2023-01-08T00:00:00Z"
  }
}
```

### POST /auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### POST /auth/logout
Logout and invalidate current session (requires authentication).

### POST /auth/refresh-token
Refresh JWT token (requires authentication).

### GET /auth/profile
Get current user profile (requires authentication).

### PUT /auth/profile
Update basic user profile (requires authentication).

---

## Profile Management Endpoints

### GET /profile/complete
Get complete user profile with all sections.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "profile_completed": true,
    "skin_profiles": {...},
    "hair_profiles": {...},
    "lifestyle_demographics": {...},
    "health_medical_conditions": {...},
    "makeup_preferences": {...}
  }
}
```

### Skin Profile Endpoints

#### GET /profile/skin
Get user's skin profile.

#### PUT /profile/skin
Update skin profile.

**Request Body:**
```json
{
  "skin_type": "combination",
  "skin_tone": "medium",
  "undertone": "warm",
  "fitzpatrick_phototype": 3,
  "primary_concerns": ["acne", "hyperpigmentation", "dryness"],
  "known_allergies": ["fragrance", "parabens"],
  "skin_sensitivity": "medium",
  "daily_sun_exposure": 120,
  "sunscreen_usage": "daily",
  "current_routine": {
    "morning": ["cleanser", "moisturizer", "sunscreen"],
    "evening": ["cleanser", "serum", "moisturizer"]
  },
  "photo_analysis_consent": true
}
```

#### POST /profile/skin/upload-photo
Upload face photo for AI analysis (multipart/form-data).

**Form Data:**
- `face_photo`: Image file (JPEG, PNG)

### Hair Profile Endpoints

#### GET /profile/hair
Get user's hair profile.

#### PUT /profile/hair
Update hair profile.

**Request Body:**
```json
{
  "hair_pattern": "wavy",
  "hair_texture": "medium",
  "hair_thickness": "medium",
  "hair_density": "high",
  "scalp_type": "normal",
  "scalp_concerns": ["dandruff"],
  "hair_porosity": "normal",
  "hair_concerns": ["frizz", "dryness"],
  "chemical_treatments": {
    "coloring": "yes",
    "last_treatment_date": "2023-06-01"
  },
  "heat_styling_frequency": "weekly",
  "current_hair_routine": {
    "shampoo_frequency": "3_times_week",
    "conditioning": "every_wash",
    "oils_used": ["coconut", "argan"]
  },
  "wash_frequency": 3
}
```

### Lifestyle Demographics Endpoints

#### GET /profile/lifestyle
Get lifestyle and demographics data.

#### PUT /profile/lifestyle
Update lifestyle demographics.

**Request Body:**
```json
{
  "location_city": "Mumbai",
  "location_state": "Maharashtra",
  "climate_type": "tropical",
  "pollution_level": "high",
  "uv_exposure_level": "high",
  "water_quality": "hard",
  "diet_type": "vegetarian",
  "hydration_level": "good",
  "dietary_preferences": {
    "spicy_food": true,
    "processed_food": "minimal"
  },
  "sleep_hours": 7.5,
  "sleep_quality": "good",
  "stress_level": "moderate",
  "exercise_frequency": "moderate",
  "smoking_status": "never",
  "alcohol_consumption": "rarely",
  "work_environment": "air_conditioned_office",
  "screen_time_hours": 8.0,
  "ac_exposure_hours": 9.0
}
```

### Health Medical Conditions Endpoints

#### GET /profile/health
Get health and medical conditions.

#### PUT /profile/health
Update health medical conditions.

**Request Body:**
```json
{
  "skin_conditions": ["eczema", "rosacea"],
  "hair_scalp_disorders": ["seborrheic_dermatitis"],
  "systemic_allergies": ["nuts", "shellfish"],
  "photosensitivity": false,
  "current_medications": {
    "skincare": ["retinoid", "vitamin_c"],
    "oral": ["multivitamin"]
  },
  "hormonal_status": "normal",
  "menstrual_cycle_regularity": "regular",
  "chronic_conditions": ["diabetes"],
  "family_history_skin": ["melasma"],
  "family_history_hair": ["male_pattern_baldness"],
  "mental_health_status": "stable"
}
```

### Makeup Preferences Endpoints

#### GET /profile/makeup
Get makeup preferences.

#### PUT /profile/makeup
Update makeup preferences.

**Request Body:**
```json
{
  "foundation_shade": "Medium 3",
  "foundation_undertone": "warm",
  "foundation_finish": "satin",
  "coverage_preference": "medium",
  "makeup_frequency": "daily",
  "makeup_style": "professional",
  "preferred_lip_colors": ["nude", "coral", "red"],
  "preferred_eye_colors": ["brown", "gold", "neutral"],
  "preferred_blush_colors": ["peach", "coral"],
  "product_finish_preferences": {
    "eyeshadow": "matte",
    "lipstick": "satin"
  },
  "brand_preferences": ["Maybelline", "L'Oreal", "Lakme"],
  "price_range_preference": "mid_range",
  "makeup_allergies": ["nickel", "cobalt"],
  "sensitive_eyes": false,
  "contact_lenses": true
}
```

---

## Activity Tracking Endpoints

### POST /activity/track
Generic activity tracking (optional authentication).

**Request Body:**
```json
{
  "activity_type": "product_view",
  "product_id": "product_123",
  "search_query": "moisturizer for dry skin",
  "filters_applied": {
    "skin_type": "dry",
    "price_range": "mid"
  },
  "page_url": "/products/moisturizer-123",
  "referrer_url": "/search",
  "session_id": "session_abc123",
  "metadata": {
    "custom_data": "value"
  }
}
```

### POST /activity/track/product-view
Track product view.

**Request Body:**
```json
{
  "product_id": "product_123",
  "page_url": "/products/moisturizer-123",
  "referrer_url": "/search",
  "session_id": "session_abc123"
}
```

### POST /activity/track/search
Track search query.

**Request Body:**
```json
{
  "search_query": "moisturizer for sensitive skin",
  "filters_applied": {
    "skin_type": "sensitive",
    "price_range": "budget"
  },
  "results_count": 15,
  "session_id": "session_abc123"
}
```

### POST /activity/track/filter
Track filter application.

**Request Body:**
```json
{
  "filters_applied": {
    "skin_type": "oily",
    "brand": "Neutrogena"
  },
  "search_context": "moisturizer",
  "results_count": 8,
  "session_id": "session_abc123"
}
```

### POST /activity/track/recommendation
Track recommendation interaction.

**Request Body:**
```json
{
  "activity_type": "recommendation_clicked",
  "product_id": "product_456",
  "recommendation_context": "similar_products",
  "position": 2,
  "session_id": "session_abc123"
}
```

### POST /activity/track/wishlist
Track wishlist action (requires authentication).

**Request Body:**
```json
{
  "activity_type": "wishlist_add",
  "product_id": "product_789",
  "session_id": "session_abc123"
}
```

### GET /activity/history
Get user activity history (requires authentication).

**Query Parameters:**
- `activity_type` (optional): Filter by activity type
- `limit` (optional): Number of records (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `start_date` (optional): Filter from date
- `end_date` (optional): Filter to date

### GET /activity/analytics
Get user activity analytics (requires authentication).

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "activity_breakdown": {
      "product_view": 25,
      "search_query": 10,
      "recommendation_clicked": 5
    },
    "most_viewed_products": [
      {
        "product_id": "product_123",
        "view_count": 5
      }
    ],
    "total_activities": 40,
    "period_days": 30
  }
}
```

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (e.g., email already exists)
- `500` - Internal Server Error

---

## Database Schema

The system uses the following main tables:

1. **users** - Basic user information and authentication
2. **skin_profiles** - Detailed skin analysis and preferences
3. **hair_profiles** - Hair type and care information
4. **lifestyle_demographics** - Environmental and lifestyle factors
5. **health_medical_conditions** - Health conditions affecting skin/hair
6. **makeup_preferences** - Makeup style and product preferences
7. **user_activity_tracking** - User behavior and interaction analytics
8. **user_sessions** - JWT session management

## Getting Started

1. Set up environment variables (copy from `env.sample`)
2. Ensure Supabase database is configured
3. Run migrations (already applied via API)
4. Start the server: `npm run dev`
5. Test authentication: `POST /api/auth/register`
6. Complete profile setup using profile endpoints
7. Track user activities for personalized recommendations 