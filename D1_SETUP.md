# 🆓 Cloudflare D1 Setup - FREE Database

## Why D1? 
- ✅ **100% FREE** up to 100,000 reads/day
- ✅ **No credit card required**
- ✅ **SQLite-based** (familiar SQL)
- ✅ **Global edge distribution**
- ✅ **Integrates with your Cloudflare Workers**

## Step 1: Set Up D1 Database (5 minutes)

### 1. Install Wrangler (if not already installed)
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```
This opens your browser to login to Cloudflare.

### 3. Create D1 Database
```bash
# Create the database
wrangler d1 create carbon-recycling-platform

# This will output something like:
# ✅ Successfully created DB 'carbon-recycling-platform' in region EEUR
# Created your database using D1's new Storage API:
# [[d1_databases]]
# binding = "DB" # i.e. available in your Worker on env.DB
# database_name = "carbon-recycling-platform"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 4. Copy the database_id
Save the `database_id` from the output above - you'll need it next.

## Step 2: Configure Your Worker

### 1. Update `apps/api/wrangler.toml`
```bash
cd apps/api
```

Add this to your `wrangler.toml` file:
```toml
[[d1_databases]]
binding = "DB"
database_name = "carbon-recycling-platform"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with your actual database_id
```

### 2. Create Database Schema
```bash
# Create the schema file for D1 (SQLite syntax)
wrangler d1 execute carbon-recycling-platform --local --file=../../packages/db/schema-d1.sql

# For remote database (when ready for production):
# wrangler d1 execute carbon-recycling-platform --file=../../packages/db/schema-d1.sql
```

## Step 3: Update Your API to Use D1

### 1. Update API to use D1 service
```bash
# Replace the current database service with D1 version
cp apps/api/src/index.ts apps/api/src/index-planetscale-backup.ts
cp apps/api/src/services/d1DatabaseService.ts apps/api/src/services/databaseService.ts
```

### 2. Update the main API file
The API will now use D1 instead of PlanetScale or mock data.

## Step 4: Test Everything

### 1. Start development server with D1
```bash
npm run dev
```

### 2. Test the API
```bash
# Test API health
curl http://localhost:8787/api/v1/health

# Test with auth (uses mock auth for development)
curl -H "Authorization: Bearer dev-token" http://localhost:8787/api/v1/auth/user
```

### 3. Create and test with sample data
```bash
# Create sample data
curl -X POST -H "Authorization: Bearer dev-token" \
     -H "Content-Type: application/json" \
     http://localhost:8787/api/v1/test/create-sample-data

# Process calculations
curl -X POST -H "Authorization: Bearer dev-token" \
     http://localhost:8787/api/v1/calculations

# View results
curl -H "Authorization: Bearer dev-token" \
     http://localhost:8787/api/v1/emissions/summary
```

## Step 5: Production Deployment

### 1. Deploy database schema to production
```bash
cd apps/api
wrangler d1 execute carbon-recycling-platform --file=../../packages/db/schema-d1.sql
```

### 2. Deploy your Worker
```bash
wrangler deploy
```

## ✅ You're Done!

You now have:
- ✅ **FREE** Cloudflare D1 database
- ✅ **Real** data persistence (no more mock data)
- ✅ **Global edge** distribution
- ✅ **Production-ready** setup

## Troubleshooting

### Database not found
- Make sure you added the `[[d1_databases]]` section to `apps/api/wrangler.toml`
- Double-check the `database_id` matches what you got from `wrangler d1 create`

### Schema errors
- Run `wrangler d1 execute carbon-recycling-platform --local --file=../../packages/db/schema-d1.sql` for local testing
- Use `wrangler d1 execute carbon-recycling-platform --file=../../packages/db/schema-d1.sql` for production

### Still seeing mock data
- Make sure you restarted the dev server after updating the code
- Check that `env.DB` is available in your Worker
