# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Environment Variables**: Prepare all required environment variables

## Required Environment Variables

Set these in your Vercel project dashboard or during deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `JWT_SECRET` | JWT signing secret (32+ chars in production) | `your_super_secret_jwt_key_here_make_it_very_long_and_random` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `GEMINI_API_KEY` | Google Gemini AI API key | `AIzaSyB...` |
| `FRONTEND_URL` | Your frontend URL for CORS | `https://your-frontend.vercel.app` |
| `NODE_ENV` | Environment (automatically set by Vercel) | `production` |

## Deployment Methods

### Method 1: Vercel CLI (Recommended)

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy from project root**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Set up and deploy? `Y`
   - Which scope? Choose your account/team
   - Link to existing project? `N` (for first deployment)
   - What's your project's name? `xpertbuyer-backend-api`
   - In which directory is your code located? `./`

4. **Set environment variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add JWT_SECRET
   vercel env add JWT_EXPIRES_IN
   vercel env add GEMINI_API_KEY
   vercel env add FRONTEND_URL
   ```

5. **Redeploy with environment variables**:
   ```bash
   vercel --prod
   ```

### Method 2: GitHub Integration

1. **Push to GitHub** (if not already done)
2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   
3. **Configure**:
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `npm install`

4. **Set Environment Variables**:
   - In project settings, add all required environment variables

## Configuration Files

The following files have been configured for Vercel deployment:

### `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/server.js": {
      "maxDuration": 30
    }
  }
}
```

### Modified `src/server.js`
- Added Vercel environment detection
- Conditional server startup (Vercel handles this)
- Environment validation for serverless

## Post-Deployment

1. **Test your deployment**:
   ```bash
   curl https://your-deployment-url.vercel.app/api/health
   ```

2. **Update your frontend**:
   - Update your frontend to use the new Vercel API URL
   - Ensure CORS is properly configured

3. **Monitor logs**:
   ```bash
   vercel logs https://your-deployment-url.vercel.app
   ```

## API Endpoints

Once deployed, your API will be available at:
- Base URL: `https://your-deployment-url.vercel.app`
- Health Check: `GET /api/health`
- Search: `POST /api/search`
- Product Details: `GET /api/products/:productId`
- Compare: `POST /api/compare`
- Product Videos: `GET /api/products/:productId/videos`
- Videos Summary: `GET /api/videos/products-summary`

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**:
   - Ensure all required env vars are set in Vercel dashboard
   - Redeploy after adding environment variables

2. **Function Timeout**:
   - Current max duration is set to 30 seconds
   - Optimize long-running operations
   - Consider upgrading Vercel plan for longer timeouts

3. **CORS Issues**:
   - Ensure `FRONTEND_URL` environment variable is correctly set
   - Check that your frontend domain is whitelisted

4. **Cold Start Performance**:
   - First request might be slow due to serverless cold start
   - Consider implementing warming strategies for production

### Viewing Logs

```bash
# View function logs
vercel logs your-deployment-url.vercel.app

# View real-time logs
vercel logs your-deployment-url.vercel.app --follow
```

## Security Considerations

1. **Environment Variables**: Never commit real environment variables to Git
2. **JWT Secret**: Use a strong, randomly generated secret (32+ characters)
3. **CORS**: Only allow trusted frontend domains
4. **Rate Limiting**: Configured and active in production
5. **Helmet**: Security headers are properly configured

## Cost Considerations

- **Hobby Plan**: 100GB bandwidth, 100GB-hours execution time
- **Pro Plan**: 1TB bandwidth, 1000GB-hours execution time
- Monitor usage in Vercel dashboard

## Next Steps

1. Set up custom domain (optional)
2. Configure monitoring and alerting
3. Set up staging environment
4. Implement CI/CD pipeline
5. Configure database connection pooling if needed 