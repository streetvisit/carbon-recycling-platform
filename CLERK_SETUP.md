# Clerk Authentication Setup Guide

This guide will help you set up Clerk authentication for the Carbon Recycling Platform.

## Prerequisites

- A Clerk account (sign up at https://clerk.com)
- Access to your deployed application domain

## Steps

### 1. Create a Clerk Application

1. Go to https://dashboard.clerk.com
2. Click "Add application" or select an existing one
3. Choose your application type (we're using JavaScript/TypeScript)
4. Note your application name

### 2. Get Your API Keys

From your Clerk Dashboard:

1. Navigate to **API Keys** in the left sidebar
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

**IMPORTANT**: Never commit your secret key to version control!

### 3. Configure Environment Variables

#### For Local Development

Update `apps/web/.env`:

```bash
# Clerk Authentication
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_actual_secret_key_here

# API Configuration
PUBLIC_API_BASE_URL=http://localhost:8787/api/v1
API_BASE_URL=http://localhost:8787/api/v1

# Environment
NODE_ENV=development
PUBLIC_ENV=development
```

#### For Production (Cloudflare Pages)

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

```
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_actual_publishable_key_here
CLERK_SECRET_KEY=sk_live_your_actual_secret_key_here
PUBLIC_API_BASE_URL=https://api.carbonrecycling.co.uk/api/v1
API_BASE_URL=https://api.carbonrecycling.co.uk/api/v1
NODE_ENV=production
PUBLIC_ENV=production
```

**Note**: Use production keys (starting with `pk_live_` and `sk_live_`) for production!

### 4. Configure Allowed Domains in Clerk

1. In your Clerk Dashboard, go to **Settings** → **Domains**
2. Add your allowed domains:
   - For development: `http://localhost:4321` or `http://localhost:3000`
   - For production: `https://yourdomain.com` or `https://your-project.pages.dev`

### 5. Configure Redirect URLs

1. In Clerk Dashboard, go to **Paths**
2. Set the following paths:
   - **Sign in**: `/sign-in`
   - **Sign up**: `/sign-up`
   - **User profile**: `/dashboard`
   - **After sign in**: `/dashboard`
   - **After sign up**: `/dashboard`

### 6. Test Your Setup

#### Local Testing

1. Start your development server:
   ```bash
   cd apps/web
   npm run dev
   ```

2. Navigate to `http://localhost:4321`

3. Try signing up/signing in - you should see the Clerk authentication UI

4. Check the browser console for any errors

#### Production Testing

1. Deploy your application to Cloudflare Pages

2. Navigate to your production URL

3. Test sign up/sign in functionality

4. Verify the warning in console changes from:
   ```
   Clerk: Clerk has been loaded with development keys...
   ```
   to no warning (when using production keys)

### 7. Verify Authentication

Check that authentication is working by:

1. **Sign up flow**: Create a new account
2. **Sign in flow**: Log in with existing credentials
3. **Protected routes**: Try accessing `/dashboard` - should require auth
4. **Token retrieval**: Check Network tab in DevTools for Bearer tokens in API calls

### Common Issues

#### Issue: "Clerk publishable key not found"
**Solution**: Ensure your `.env` file has the `PUBLIC_CLERK_PUBLISHABLE_KEY` variable set and you've restarted the dev server

#### Issue: "Development keys in production"
**Solution**: Replace `pk_test_` and `sk_test_` keys with `pk_live_` and `sk_live_` production keys in your Cloudflare Pages environment variables

#### Issue: CORS errors
**Solution**: Add your domain to Clerk's allowed domains list in the Clerk Dashboard

#### Issue: Redirect loops
**Solution**: Check your redirect URLs in Clerk Dashboard match your application's routes

### Security Best Practices

1. **Never commit secret keys** to version control
2. **Use test keys** for development, **live keys** for production
3. **Rotate keys** periodically from the Clerk Dashboard
4. **Enable MFA** in your Clerk Dashboard for added security
5. **Monitor** authentication logs in Clerk Dashboard

### Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Astro Integration](https://clerk.com/docs/quickstarts/astro)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [Clerk Community](https://clerk.com/discord)

### Testing Checklist

- [ ] Environment variables are set correctly
- [ ] Publishable key starts with `pk_test_` (dev) or `pk_live_` (prod)
- [ ] Secret key starts with `sk_test_` (dev) or `sk_live_` (prod)
- [ ] Allowed domains are configured in Clerk Dashboard
- [ ] Sign up flow works
- [ ] Sign in flow works
- [ ] Sign out flow works
- [ ] Protected routes require authentication
- [ ] API calls include Bearer tokens
- [ ] No console errors related to Clerk
- [ ] Production deployment uses live keys

---

## Current Status

Your application currently has **test/mock keys** set up. These need to be replaced with actual Clerk keys for authentication to work properly.

**Next Steps**:
1. Sign up for Clerk at https://clerk.com
2. Create an application in the Clerk Dashboard
3. Copy your API keys
4. Update your `.env` file (local) and Cloudflare Pages environment variables (production)
5. Test the authentication flows

Once you've completed these steps, authentication will be fully functional!
