# Security Configuration

## Setting up Clerk Secrets

For security reasons, Clerk API keys should NOT be stored in `wrangler.toml`. Instead, use Cloudflare Workers secrets.

### Local Development

For local development, create a `.dev.vars` file in the `apps/api` directory:

```bash
# apps/api/.dev.vars
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

**Important:** The `.dev.vars` file is already in `.gitignore` and should NEVER be committed to version control.

### Production/Preview Environments

Use the Wrangler CLI to set secrets for production:

```bash
# Navigate to the API directory
cd apps/api

# Set the Clerk publishable key
wrangler secret put CLERK_PUBLISHABLE_KEY
# You'll be prompted to enter the value

# Set the Clerk secret key
wrangler secret put CLERK_SECRET_KEY
# You'll be prompted to enter the value
```

### Verifying Secrets

To list all secrets (without showing values):

```bash
wrangler secret list
```

### Rotating Secrets

To update a secret:

```bash
wrangler secret put CLERK_SECRET_KEY
```

### Deleting Secrets

To remove a secret:

```bash
wrangler secret delete CLERK_SECRET_KEY
```

## Other Environment Variables

Non-sensitive configuration can remain in `wrangler.toml` under `[vars]`:

- `ENVIRONMENT` - deployment environment (development/staging/production)
- `ALLOWED_ORIGINS` - comma-separated list of additional CORS origins

## Security Best Practices

1. ✅ Use `wrangler secret put` for sensitive values (API keys, tokens, passwords)
2. ✅ Use `.dev.vars` for local development secrets
3. ✅ Keep `.dev.vars` in `.gitignore`
4. ✅ Rotate secrets regularly
5. ✅ Use different keys for development and production
6. ❌ Never commit secrets to version control
7. ❌ Never share secrets in chat, email, or documentation
