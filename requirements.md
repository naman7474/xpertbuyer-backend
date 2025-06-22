# Beauty AI Platform - Backend API Documentation

## Base URL
```
https://api.beautyai.com/v1
```

## Authentication
All endpoints except `/auth/login` and `/auth/signup` require authentication via JWT token.

```
Headers:
Authorization: Bearer <jwt_token>
```

## API Endpoints

### 1. Authentication

#### POST `/auth/signup`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "created_at": "2024-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST `/auth/login`
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST `/auth/logout`
Invalidate current session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2. User Profile

#### GET `/user/profile`
Get current user's complete profile including beauty preferences.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "name": "John Doe",
    "email": "user@example.com",
    "profile": {
      "skinType": "Oily & Shiny",
      "skinConcerns": ["Acne", "Dark Spots"],
      "skinSensitivity": "Slightly Sensitive",
      "hairType": "Wavy",
      "hairConcerns": ["Frizz", "Dryness"],
      "sleepHours": "7-9 hours",
      "waterIntake": "6-8 glasses",
      "stressLevel": "Moderate",
      "allergies": "None",
      "medications": "None",
      "makeupFrequency": "Daily",
      "makeupStyle": "Natural"
    },
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-20T15:30:00Z"
  }
}
```

#### PUT `/user/profile`
Update user's beauty profile.

**Request:**
```json
{
  "profile": {
    "skinType": "Combination",
    "skinConcerns": ["Acne", "Large Pores"],
    "stressLevel": "High"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "profile": { /* updated profile object */ }
  }
}
```

### 3. Photo Analysis

#### POST `/analysis/photo`
Upload photo for AI skin analysis.

**Request:**
```
Content-Type: multipart/form-data
photo: <binary_image_data>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_456",
    "status": "processing",
    "estimated_time": 30
  }
}
```

#### GET `/analysis/{analysis_id}`
Get photo analysis results.

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_456",
    "status": "completed",
    "results": {
      "faceAnalysis": {
        "detectedIssues": [
          "Mild acne on T-zone",
          "Dark spots on cheeks",
          "Under-eye circles"
        ],
        "skinTone": "Medium with warm undertones",
        "faceShape": "Oval",
        "confidence": 0.92
      },
      "skinScore": 78,
      "concerns": [
        {
          "issue": "Excess Oil",
          "severity": "Moderate",
          "location": ["forehead", "nose"],
          "confidence": 0.88
        },
        {
          "issue": "Dark Spots",
          "severity": "Mild",
          "location": ["cheeks"],
          "confidence": 0.85
        },
        {
          "issue": "Acne",
          "severity": "Mild", 
          "location": ["forehead", "chin"],
          "confidence": 0.90
        }
      ],
      "recommendations_summary": "Focus on oil control and brightening"
    }
  }
}
```

### 4. Product Recommendations

#### GET `/recommendations`
Get personalized product recommendations based on profile and analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "category": "Cleanser",
        "theory": "Your oily, acne-prone skin produces excess sebum...",
        "products": [
          {
            "id": "prod_001",
            "name": "Gentle Foam Cleanser",
            "brand": "PureGlow",
            "category": "skincare",
            "subcategory": "cleanser",
            "imageUrl": "https://cdn.beautyai.com/products/prod_001.jpg",
            "price": 24.99,
            "size": "150ml",
            "ingredients": ["Salicylic Acid", "Green Tea Extract", "Aloe Vera"],
            "keyIngredients": ["2% Salicylic Acid"],
            "benefits": ["Deep cleansing", "Gentle on skin", "Removes makeup"],
            "targetConcerns": ["oily skin", "acne"],
            "applicationArea": ["face"],
            "usage": {
              "frequency": "Daily",
              "time": "both",
              "amount": "Pea-sized",
              "instructions": "Massage onto wet face, rinse thoroughly"
            },
            "matchScore": 95,
            "reason": "Targets acne with 2% salicylic acid, perfect for your oily T-zone"
          }
        ]
      }
    ],
    "routine": {
      "morning": [
        { "step": 1, "product_id": "prod_001", "duration": "30 sec" },
        { "step": 2, "product_id": "prod_003", "duration": "1 min" },
        { "step": 3, "product_id": "prod_002", "duration": "30 sec" },
        { "step": 4, "product_id": "prod_004", "duration": "1 min" }
      ],
      "evening": [
        { "step": 1, "product_id": "prod_001", "duration": "1 min" },
        { "step": 2, "product_id": "prod_005", "duration": "30 sec" },
        { "step": 3, "product_id": "prod_003", "duration": "1 min" },
        { "step": 4, "product_id": "prod_002", "duration": "30 sec" },
        { "step": 5, "product_id": "prod_006", "duration": "30 sec" }
      ]
    }
  }
}
```

### 5. Progress Tracking

#### POST `/progress/routine`
Log daily routine completion.

**Request:**
```json
{
  "date": "2024-01-20",
  "morning": true,
  "evening": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Routine logged successfully",
    "streak": {
      "current": 3,
      "best": 7
    }
  }
}
```

#### GET `/progress/stats`
Get user's progress statistics.

**Query Parameters:**
- `period`: `week` | `month` | `all`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "week",
    "completionRate": 85,
    "currentStreak": 3,
    "bestStreak": 7,
    "totalDays": 42,
    "routineData": [
      {
        "date": "2024-01-20",
        "morning": true,
        "evening": true
      },
      {
        "date": "2024-01-19",
        "morning": true,
        "evening": false
      }
    ],
    "improvements": {
      "skinScore": {
        "initial": 65,
        "current": 78,
        "change": "+20%"
      },
      "concerns": {
        "acne": { "change": "+30%" },
        "darkSpots": { "change": "+15%" },
        "oiliness": { "change": "+25%" }
      }
    }
  }
}
```

#### POST `/progress/feedback`
Submit user feedback after 7 days of usage.

**Request:**
```json
{
  "improvement": "Much Better",
  "comments": "Skin feels less oily and acne is clearing up",
  "concerns_improved": ["acne", "oiliness"],
  "concerns_unchanged": ["dark spots"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Thank you for your feedback",
    "recommendations_updated": true
  }
}
```

### 6. Influencers

#### GET `/influencers/recommended`
Get recommended influencers based on user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "influencers": [
      {
        "id": "inf_001",
        "name": "Sarah Chen",
        "handle": "@glowwithsarah",
        "profileImage": "https://cdn.beautyai.com/influencers/inf_001.jpg",
        "followers": "124K",
        "skinType": "Oily",
        "skinConcerns": ["Acne", "Dark Spots"],
        "bio": "Skincare enthusiast sharing my journey to clear skin",
        "matchScore": 92,
        "totalVideos": 45,
        "followStatus": false
      }
    ]
  }
}
```

#### GET `/influencers/{influencer_id}/videos`
Get videos from a specific influencer.

**Response:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "vid_001",
        "influencer_id": "inf_001",
        "thumbnail": "https://cdn.beautyai.com/videos/thumb_001.jpg",
        "title": "My Morning Routine for Oily Skin",
        "views": "45K",
        "duration": "8:24",
        "published_at": "2024-01-10T08:00:00Z",
        "featured_products": [
          {
            "product_id": "prod_001",
            "timestamp": "2:30"
          }
        ]
      }
    ]
  }
}
```

#### POST `/influencers/{influencer_id}/follow`
Follow/unfollow an influencer.

**Request:**
```json
{
  "action": "follow"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Now following Sarah Chen",
    "followStatus": true
  }
}
```

### 7. Products

#### GET `/products/{product_id}`
Get detailed product information.

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prod_001",
      "name": "Gentle Foam Cleanser",
      "brand": "PureGlow",
      "category": "skincare",
      "subcategory": "cleanser",
      "imageUrl": "https://cdn.beautyai.com/products/prod_001.jpg",
      "images": [
        "https://cdn.beautyai.com/products/prod_001_1.jpg",
        "https://cdn.beautyai.com/products/prod_001_2.jpg"
      ],
      "price": 24.99,
      "size": "150ml",
      "description": "A gentle yet effective foam cleanser...",
      "ingredients": ["Water", "Salicylic Acid", "Green Tea Extract", "..."],
      "keyIngredients": ["2% Salicylic Acid", "Green Tea Extract"],
      "benefits": ["Deep cleansing", "Gentle on skin", "Removes makeup"],
      "targetConcerns": ["oily skin", "acne", "blackheads"],
      "applicationArea": ["face"],
      "usage": {
        "frequency": "Daily",
        "time": "both",
        "amount": "Pea-sized",
        "instructions": "Massage onto wet face for 30 seconds, rinse thoroughly"
      },
      "reviews": {
        "average": 4.6,
        "count": 1247
      },
      "availability": "in_stock",
      "retailLinks": [
        {
          "retailer": "Amazon",
          "url": "https://amazon.com/...",
          "price": 24.99
        },
        {
          "retailer": "Sephora",
          "url": "https://sephora.com/...",
          "price": 26.00
        }
      ]
    }
  }
}
```

#### GET `/products/search`
Search products by various criteria.

**Query Parameters:**
- `category`: `cleanser` | `moisturizer` | `serum` | `sunscreen`
- `concerns`: Comma-separated list (e.g., `acne,oily-skin`)
- `skinType`: `dry` | `oily` | `combination` | `normal` | `sensitive`
- `priceMin`: Minimum price
- `priceMax`: Maximum price
- `sort`: `relevance` | `price_low` | `price_high` | `rating`

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [ /* array of product objects */ ],
    "total": 42,
    "page": 1,
    "perPage": 20
  }
}
```

### 8. Notifications

#### GET `/notifications`
Get user notifications.

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_001",
        "type": "routine_reminder",
        "title": "Time for your evening routine!",
        "message": "Don't forget to complete your 5-step evening routine",
        "read": false,
        "created_at": "2024-01-20T19:00:00Z"
      },
      {
        "id": "notif_002",
        "type": "streak_milestone",
        "title": "7-day streak achieved! 🎉",
        "message": "Keep up the great work with your skincare routine",
        "read": true,
        "created_at": "2024-01-19T09:00:00Z"
      }
    ]
  }
}
```

#### PUT `/notifications/{notification_id}/read`
Mark notification as read.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Notification marked as read"
  }
}
```

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### Common Error Codes:
- `UNAUTHORIZED`: Invalid or missing authentication token
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

- General endpoints: 100 requests per minute
- Photo upload: 10 requests per hour
- Authentication: 5 requests per minute

## Webhooks (Optional)

### Product Price Updates
```json
{
  "event": "product.price_changed",
  "data": {
    "product_id": "prod_001",
    "old_price": 24.99,
    "new_price": 22.99,
    "timestamp": "2024-01-20T10:00:00Z"
  }
}
```

### Routine Reminders
```json
{
  "event": "routine.reminder",
  "data": {
    "user_id": "user_123",
    "routine_type": "morning",
    "scheduled_time": "2024-01-20T07:00:00Z"
  }
}
```