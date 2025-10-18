#!/bin/bash
set -e

echo "🚀 CarbonRecycling.co.uk Production Setup"
echo "========================================"
echo ""

# Check if required tools are installed
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ git is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Required tools are installed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Check for environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Please update .env with your actual credentials!"
    echo ""
    echo "   Required services to set up:"
    echo "   1. PlanetScale Database: https://planetscale.com/"
    echo "   2. Clerk Authentication: https://clerk.dev/"
    echo "   3. Cloudflare R2 Storage: https://developers.cloudflare.com/r2/"
    echo "   4. Browserless.io (optional): https://browserless.io/"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Create database setup guide
cat > DATABASE_SETUP.md << 'EOF'
# Database Setup Guide

## 1. Create PlanetScale Database

1. Sign up at https://planetscale.com/
2. Create a new database called `carbon-recycling-platform`
3. Create a branch called `main`
4. Connect to your database using the PlanetScale CLI or web console

## 2. Deploy Database Schema

Copy and paste the contents of `packages/db/schema.sql` into your PlanetScale console to create all the required tables.

## 3. Get Connection Details

1. Go to your database dashboard in PlanetScale
2. Click "Connect"
3. Select "Connect with: @planetscale/database"
4. Copy the connection details:
   - Host: `xxx-xxxx.planetscale.com`
   - Username: your generated username
   - Password: your generated password

## 4. Update Environment Variables

Update your `.env` file with the PlanetScale connection details:
```
DATABASE_HOST=xxx-xxxx.planetscale.com
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
```

## 5. Test Connection

Run the development server and test the API endpoints to ensure database connectivity.

EOF

echo "📋 Created DATABASE_SETUP.md with detailed setup instructions"
echo ""

# Create Clerk setup guide
cat > CLERK_SETUP.md << 'EOF'
# Clerk Authentication Setup Guide

## 1. Create Clerk Application

1. Sign up at https://clerk.dev/
2. Create a new application
3. Choose your authentication options (email, social, etc.)

## 2. Get API Keys

1. Go to your Clerk dashboard
2. Navigate to "Developers" > "API Keys"
3. Copy your keys:
   - Publishable Key (starts with `pk_`)
   - Secret Key (starts with `sk_`)

## 3. Update Environment Variables

Update your `.env` file:
```
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

## 4. Configure Frontend

Update your Astro frontend configuration to use Clerk components for authentication.

## 5. Set Up Organizations

Configure Clerk to support organizations (multi-tenant) in your dashboard settings.

EOF

echo "📋 Created CLERK_SETUP.md with authentication setup instructions"
echo ""

# Build the project to check for errors
echo "🔨 Building project to check for errors..."
if npm run build; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi
echo ""

# Create development start script
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting CarbonRecycling.co.uk Development Environment"
echo "========================================================"
echo ""
echo "Frontend: http://localhost:4321"
echo "API: http://localhost:8787"
echo ""
echo "Press Ctrl+C to stop the servers"
echo ""
npm run dev
EOF

chmod +x start-dev.sh

echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. 📝 Update .env with your service credentials"
echo "2. 📖 Read DATABASE_SETUP.md to set up PlanetScale"
echo "3. 🔐 Read CLERK_SETUP.md to set up authentication"
echo "4. 🚀 Run ./start-dev.sh to start development servers"
echo ""
echo "Production deployment:"
echo "• Frontend: Deploy to Cloudflare Pages"
echo "• API: Deploy to Cloudflare Workers"
echo "• Database: Already hosted on PlanetScale"
echo ""
echo "For support, visit: https://github.com/your-repo/issues"