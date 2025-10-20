#!/bin/bash

# Cloudflare Pages Build Script
# This script ensures builds work correctly regardless of directory structure

echo "🔧 Starting Carbon Recycling Platform build..."
echo "📦 Version: v2024.10.20-18:19-critical-fixes"
echo "🕒 Build Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Print debug information
echo "📂 Current directory: $(pwd)"
echo "📋 Directory contents:"
ls -la

# Check if we're in the right place
if [ -f "apps/web/package.json" ]; then
    echo "✅ Found monorepo structure, building from apps/web"
    cd apps/web
    npm install
    npm run build
    
    # Copy build output to root for Cloudflare Pages
    echo "📦 Copying dist to root..."
    cp -r dist/* ../..
    
elif [ -f "package.json" ] && [ -f "astro.config.mjs" ]; then
    echo "✅ Found web app, building directly"
    npm install
    npm run build
else
    echo "❌ Cannot find valid build configuration"
    echo "📋 Looking for package.json and astro.config.mjs"
    find . -name "package.json" -type f
    find . -name "astro.config.mjs" -type f
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📦 Output directory contents:"
ls -la dist/ || ls -la