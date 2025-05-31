# XpertBuyer Backend API

AI-powered skincare product recommendation backend built with Node.js, Express, Gemini AI, and Supabase.

## Features

- **Intelligent Query Parsing**: Uses Gemini AI to extract structured parameters from natural language queries
- **Semantic Product Search**: Advanced product retrieval with filtering and ranking
- **User Segment Detection**: Automatically identifies user segments (Concern-Focused, Ingredient-Conscious, etc.)
- **AI-Powered Ranking**: Products ranked based on relevance, user segment, and preferences
- **Ingredient Insights**: Contextual ingredient highlights based on user concerns
- **Product Comparison**: Side-by-side product comparison with insights
- **Video Reviews Integration**: Influencer video reviews and mentions
- **Rate Limiting & Security**: Built-in security and rate limiting

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
   PORT=3000
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

3. **AI Ranking** (`geminiService.rankProducts`)
   - Ranks products based on user segment
   - Considers relevance, ratings, price sensitivity
   - Personalized recommendations

4. **Result Formatting** (`searchService.search`)
   - Formats products for frontend consumption
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
- `yt_videos`: YouTube video reviews
- `product_video_mentions`: Product mentions in videos

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
curl http://localhost:3000/api/health

# Search products
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "vitamin C serum for dark spots"}'

# Get product details
curl http://localhost:3000/api/products/your-product-id
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
PORT=3000
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
EXPOSE 3000
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