# XpertBuyer Backend API

AI-powered skincare product recommendation backend built with Node.js, Express, Gemini AI, and Supabase.

## Features

- **Intelligent Query Parsing**: Uses Gemini AI to extract structured parameters from natural language queries
- **Semantic Product Search**: Advanced product retrieval with filtering and ranking
- **User Segment Detection**: Automatically identifies user segments (Concern-Focused, Ingredient-Conscious, etc.)
- **AI-Powered Ranking & Explanations**: Products are ranked by Gemini AI, which also provides a specific, user-friendly reason for each recommendation
- **Ingredient Insights**: Contextual ingredient highlights based on user concerns
- **Product Comparison**: Side-by-side product comparison with insights
- **Video Content Analytics**: Get video content where products are mentioned
- **Creator Analytics**: Track distinct creators who mention each product  
- **Video Reviews Integration**: Influencer video reviews and mentions
- **Rate Limiting & Security**: Built-in security and rate limiting

## How Recommendations Work

When you search for products, Gemini AI:
1. Parses your query to understand your needs and preferences
2. Retrieves a set of relevant products from the database
3. Ranks the products for your specific query and user segment
4. **For each product, generates a concise, human-readable explanation ("match reason") for why it was recommended**
5. The API response includes these AI-generated reasons, so users always know *why* a product is a good fit

**Example:**
- Top pick for you! SPF 50+ protection perfect for oily, sensitive skin with zinc oxide
- Gentle mineral sunscreen with niacinamide for oil control without irritation

## Video Content Analytics

The API provides comprehensive video content analytics for each product:

- **Video URLs**: Direct links to videos where products are mentioned
- **Creator Information**: Names and channels of content creators
- **Video Metrics**: View counts, likes, and engagement data
- **Mention Analysis**: Sentiment analysis and claims about products
- **Segment Details**: Precise timestamps and context of product mentions

This enables the frontend to:
- Display video reviews for each product
- Show which influencers recommend products
- Provide social proof through video content
- Track product popularity across different creators

## API Endpoints

### Search Products
```http
POST /api/search
Content-Type: application/json

{
  "query": "niacinamide serum for acne",
  "limit": 4,
  "includeIngredients": true
}
```

### Get Product Details
```http
GET /api/products/{productId}
```

### Compare Products
```http
POST /api/compare
Content-Type: application/json

{
  "productIds": ["product-id-1", "product-id-2", "product-id-3"]
}
```

### Get Product Videos
Get video content for a specific product, including creator mentions and video details.

```http
GET /api/products/{productId}/videos
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "productId": "tea-tree-face-wash-with-neem-for-acne-pimples-250ml",
    "videoCount": 1,
    "creatorCount": 1,
    "creators": ["Mamaearth India"],
    "videos": [
      {
        "videoId": "DYFkTSUFWTU",
        "title": "Know How To Fight Pimples & Acne With Tea Tree | Mamaearth Face Care",
        "channelTitle": "Mamaearth India",
        "publishedAt": "2022-09-02T14:24:04",
        "duration": 28,
        "viewCount": 589577,
        "likeCount": 12770,
        "thumbnail": "https://i.ytimg.com/vi/DYFkTSUFWTU/default.jpg",
        "videoUrl": "https://youtu.be/DYFkTSUFWTU",
        "mentions": [
          {
            "segmentId": 23,
            "startTime": 0,
            "endTime": 15,
            "text": "This is embarrassing moment when our face has a pimple...",
            "sentiment": "positive",
            "claimType": "mention",
            "claimText": "Product mentioned",
            "confidence": 0.72
          }
        ]
      }
    ]
  },
  "meta": {
    "timestamp": "2025-06-01T07:47:30.254Z",
    "totalMentions": 2
  }
}
```

### Get Videos Summary for Multiple Products
Get a summary of video content for multiple products at once.

```http
GET /api/videos/products-summary?productIds=product-id-1,product-id-2,product-id-3
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "tea-tree-face-wash-with-neem-for-acne-pimples-250ml",
      "videoUrls": ["https://youtu.be/DYFkTSUFWTU"],
      "creatorCount": 1,
      "creators": ["Mamaearth India"]
    },
    {
      "productId": "vitamin-c-serum-20ml",
      "videoUrls": ["https://youtu.be/abc123", "https://youtu.be/def456"],
      "creatorCount": 2,
      "creators": ["Beauty Guru", "Skincare Expert"]
    }
  ],
  "meta": {
    "timestamp": "2025-06-01T07:47:38.724Z",
    "totalProducts": 2
  }
}
```

### Health Check
```http
GET /api/health
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xpertbuyer-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Supabase Configuration
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Configuration

### Gemini AI Setup
1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your `.env` file as `GEMINI_API_KEY`

### Supabase Setup
1. Get your project URL and anon key from your Supabase dashboard
2. Add them to your `.env` file

## Architecture

### Search Process (4 Steps)

1. **Query Parsing** (`geminiService.parseQuery`)
   - Extracts structured parameters from natural language
   - Identifies user intent and segment
   - Maps to skincare concerns and preferences

2. **Product Retrieval** (`productService.searchProducts`)
   - Semantic search across product database
   - Filters by brand, price, product type
   - Ingredient-based filtering

3. **AI Ranking & Match Reason Generation** (`geminiService.rankProducts`)
   - Ranks products based on user segment and query
   - Considers relevance, ratings, price sensitivity
   - **For each product, Gemini AI generates a concise match reason explaining why it was recommended**
   - Personalized recommendations with transparent explanations

4. **Result Formatting** (`searchService.search`)
   - Formats products for frontend consumption
   - Includes Gemini's match reasons in the API response
   - Generates ingredient highlights
   - Provides contextual insights

### User Segments

- **Concern-Focused Novices**: Basic skincare concerns
- **Ingredient-Conscious**: Scientific ingredient knowledge
- **Clean/Organic Seekers**: Natural and sustainable products
- **Brand-Focused**: Specific brand preferences
- **Value Hunters**: Price-conscious shoppers
- **Luxury/Aspirational**: Premium product seekers

## Database Schema

The API works with the following Supabase tables:

- `products`: Main product information
- `ingredients`: Ingredient database with benefits
- `product_ingredients`: Product-ingredient relationships
- `yt_videos`: YouTube video reviews (title, channel, views, etc.)
- `yt_segments`: Video segments with timestamps and text
- `product_video_mentions`: Product mentions in videos with sentiment analysis

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors**: Input validation with Joi
- **Database Errors**: Supabase connection issues
- **AI Service Errors**: Gemini API failures
- **Rate Limiting**: Request throttling
- **404 Errors**: Resource not found

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Joi schema validation
- **Error Sanitization**: Safe error responses

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── constants/       # Application constants
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic
└── server.js        # Main server file
```

### Adding New Features

1. **New Service**: Add to `src/services/`
2. **New Route**: Add to `src/routes/api.js`
3. **New Controller**: Add to `src/controllers/`
4. **New Validation**: Add to `src/middleware/validation.js`

## Testing

Test the API using curl or Postman:

```bash
# Health check
curl http://localhost:5000/api/health

# Search products
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "vitamin C serum for dark spots"}'

# Get product details
curl http://localhost:5000/api/products/your-product-id

# Get product videos
curl "http://localhost:5000/api/products/tea-tree-face-wash-with-neem-for-acne-pimples-250ml/videos"

# Get videos summary for multiple products
curl "http://localhost:5000/api/videos/products-summary?productIds=product-id-1,product-id-2"

# Compare products
curl -X POST http://localhost:5000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"productIds": ["product-id-1", "product-id-2"]}'
```

## Performance Considerations

- **Caching**: Consider adding Redis for frequent queries
- **Database Indexing**: Ensure proper indexes on search fields
- **Rate Limiting**: Adjust based on usage patterns
- **AI API Limits**: Monitor Gemini API usage

## Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
GEMINI_API_KEY=your_production_key
SUPABASE_URL=your_production_url
SUPABASE_ANON_KEY=your_production_key
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support, please contact the development team or create an issue in the repository. 