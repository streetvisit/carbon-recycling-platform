# Production Deployment Checklist

## Environment Variables Required for Cloudflare Pages

### Clerk Authentication
⚠️ **CRITICAL**: The application is currently using development Clerk keys.

For production deployment, you MUST add these environment variables to Cloudflare Pages:

1. **PUBLIC_CLERK_PUBLISHABLE_KEY**
   - Get from: https://dashboard.clerk.com → Your App → API Keys
   - Format: `pk_live_xxxxxxxxxxxxx`
   - Scope: Production

2. **CLERK_SECRET_KEY**
   - Get from: https://dashboard.clerk.com → Your App → API Keys  
   - Format: `sk_live_xxxxxxxxxxxxx`
   - Scope: Production
   - ⚠️ Keep this secret! Never commit to git.

### How to Add to Cloudflare Pages:
1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages → Your Project → Settings → Environment Variables
3. Add both variables under "Production" environment
4. Redeploy the application

### Other Environment Variables
- `PUBLIC_API_BASE_URL` - Your API endpoint (if different from default)
- `PUBLIC_ENV` - Set to `production`

## Pre-Deployment Checklist

- [ ] Production Clerk keys added to Cloudflare Pages
- [ ] Environment variables configured correctly
- [ ] All console errors fixed
- [ ] API endpoints tested and working
- [ ] Mobile responsiveness verified
- [ ] Accessibility checks passed
- [ ] Performance metrics acceptable

## Post-Deployment Verification

- [ ] Authentication works with production keys
- [ ] No "development keys" warnings in console
- [ ] All API calls resolve correctly
- [ ] Energy map displays without errors
- [ ] Regional data loads properly

## Known Issues (Fixed in This Release)

✅ Clerk deprecation warnings - migrated to `fallbackRedirectUrl`
✅ Elexon BMRS MID endpoint 404 errors - removed non-existent endpoint
✅ UKEnergyMap crashes - added null safety checks
✅ Invalid generation mix data warnings - improved error handling
