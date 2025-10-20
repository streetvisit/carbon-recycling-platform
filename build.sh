#!/bin/bash
set -e  # Exit on any error

# Cloudflare Pages Build Script
echo "🔧 Starting Carbon Recycling Platform build..."
echo "📦 Version: v2024.10.20-19:17-final-fix"
echo "🕒 Build Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "📂 Current directory: $(pwd)"

# Check if we're in monorepo structure
if [ -f "apps/web/package.json" ]; then
    echo "✅ Found monorepo structure"
    
    # Build the web app
    cd apps/web
    echo "📦 Installing dependencies in apps/web..."
    npm install
    echo "🏗️ Building web app..."
    npm run build
    
    # Move back to root and ensure clean dist setup
    cd ../..
    echo "📦 Setting up output directory..."
    
    # Remove any existing dist and create fresh one
    rm -rf dist
    mkdir -p dist
    
    # Copy all files from apps/web/dist to root/dist
    cp -r apps/web/dist/* dist/
    
    echo "✅ Build completed successfully!"
    echo "📦 Final output in dist/:"
    ls -la dist/
    
else
    echo "❌ Cannot find apps/web/package.json"
    echo "📋 Current structure:"
    ls -la
    exit 1
fi
