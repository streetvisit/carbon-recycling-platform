# Deployment Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at https://cloudflare.com
2. **Clerk Account**: Sign up at https://clerk.dev
3. **PlanetScale Account**: Sign up at https://planetscale.com
4. **Node.js & pnpm**: Make sure you have Node.js 18+ and pnpm installed

## Step 1: Database Setup (PlanetScale)

1. Create a new database in PlanetScale
2. Create the schema using the SQL file:
   ```bash
   # Import the schema
   cat packages/db/schema.sql | pscale shell <database-name> <branch-name>
   ```
3. Get your connection string and add it to your environment variables

## Step 2: Authentication Setup (Clerk)

1. Create a new application in Clerk
2. Configure your redirect URLs:
   - Development: `http://localhost:4321`
   - Production: `https://your-domain.pages.dev`
3. Get your publishable and secret keys
4. Configure environment variables

## Step 3: Deploy API (Cloudflare Workers)

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

3. Configure environment variables in your Worker:
   ```bash
   cd apps/api
   wrangler secret put CLERK_SECRET_KEY
   wrangler secret put DATABASE_URL
   ```

4. Deploy the Worker:
   ```bash
   wrangler deploy
   ```

5. Note the deployed Worker URL (e.g., `https://api.your-subdomain.workers.dev`)

## Step 4: Deploy Frontend (Cloudflare Pages)

1. Build the frontend:
   ```bash
   cd apps/web
   npm run build
   ```

2. Deploy to Cloudflare Pages:
   - Option A: Connect your Git repository to Cloudflare Pages for automatic deployments
   - Option B: Manual deployment using Wrangler:
     ```bash
     wrangler pages deploy dist
     ```

3. Configure environment variables in Pages:
   - `CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
   - `API_BASE_URL`: Your deployed Worker URL

## Step 5: Configure CORS

Update your API Worker's CORS configuration to include your frontend domain:

```typescript
app.use('*', cors({
  origin: ['http://localhost:4321', 'https://your-app.pages.dev'],
  credentials: true
}))
```

## Environment Variables Summary

### Frontend (.env)
```bash
CLERK_PUBLISHABLE_KEY=pk_live_...
API_BASE_URL=https://api.your-subdomain.workers.dev
```

### API (Cloudflare Workers Secrets)
```bash
CLERK_SECRET_KEY=sk_live_...
DATABASE_URL=mysql://...
```

## Post-Deployment

1. Test the authentication flow
2. Verify API endpoints are accessible
3. Test data source creation and deletion
4. Monitor logs in Cloudflare dashboard
5. Set up alerts and monitoring

## Scaling Considerations

1. **Database**: PlanetScale automatically scales. Consider read replicas for high traffic.
2. **API**: Cloudflare Workers scale automatically. Monitor usage limits.
3. **Frontend**: Cloudflare Pages has excellent global CDN coverage.
4. **Authentication**: Clerk handles scaling automatically.

## Security Checklist

- [ ] All environment variables are properly configured
- [ ] CORS is correctly configured
- [ ] Database credentials are secured
- [ ] Clerk webhook endpoints are configured if needed
- [ ] Rate limiting is considered for API endpoints
- [ ] Input validation is implemented
- [ ] HTTPS is enforced in production