# Backend API Authentication Fix

## Problem
Your Workers API is returning 401 errors even though valid Clerk JWT tokens are being sent.

## Root Cause
The API's `authService.ts` is trying to verify Clerk tokens, but the required environment variables aren't set in your Workers deployment.

## Solution

### Step 1: Get Your Clerk Secret Key

1. Go to https://dashboard.clerk.com/
2. Select your project
3. Go to **API Keys** section
4. Copy your **Secret Key** (starts with `sk_live_...`)

### Step 2: Set Environment Variables in Cloudflare Workers

You need to add these to your Workers deployment:

```bash
# Via Wrangler CLI
cd apps/api
npx wrangler secret put CLERK_SECRET_KEY
# Paste your sk_live_... key when prompted

# Or via Cloudflare Dashboard:
# 1. Go to Workers & Pages
# 2. Select your API worker (carbon-recycling-api)
# 3. Settings → Variables
# 4. Add variable:
#    - Name: CLERK_SECRET_KEY
#    - Value: sk_live_...
# 5. Click "Save and Deploy"
```

### Step 3: Verify CORS allows your domain

Check that `carbonrecycling.co.uk` is in the allowed origins. In `apps/api/src/index.ts` line 62-66, you can add it via environment variable:

```bash
npx wrangler secret put ALLOWED_ORIGINS
# Enter: https://carbonrecycling.co.uk,https://www.carbonrecycling.co.uk
```

### Step 4: Test

After setting the secret:
1. Wait ~1 minute for Workers to redeploy
2. Go to https://carbonrecycling.co.uk/dashboard/ingestion/
3. Check if data loads without 401 errors

## Verification

You should see in console:
- ✅ `Got token: eyJhbGc...` (frontend)
- ✅ API returns 200 instead of 401
- ✅ Data sources load properly

## Troubleshooting

### Still getting 401?

Check Workers logs:
```bash
cd apps/api
npx wrangler tail
```

Then reload your page and look for errors like:
- `Token verification failed`
- `CLERK_SECRET_KEY not set`

### Token verification errors?

The Clerk token might be for a different Clerk instance. Make sure:
1. Frontend uses the same Clerk publishable key that matches the secret key
2. Both keys are from the same Clerk project
3. Using live keys (`pk_live_...` / `sk_live_...`), not test keys

## Alternative: Bypass Auth for Testing

If you want to test without fixing auth right now, you can temporarily use mock data.

The API already has a fallback that returns mock authentication if `CLERK_SECRET_KEY` isn't set (see `authService.ts` line 94-100).

However, the middleware on line 107-122 of `index.ts` is catching auth failures. You could temporarily comment out that middleware for testing.

**⚠️ Don't do this in production!**
