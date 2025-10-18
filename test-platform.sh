#!/bin/bash

echo "🧪 Testing CarbonRecycling.co.uk Platform"
echo "========================================"
echo ""

# Check if API is running
echo "1. Testing API health..."
if curl -s http://localhost:8787/api/v1/health > /dev/null; then
    echo "✅ API is responding"
    
    # Test health endpoint
    echo "2. API Health Check:"
    curl -s http://localhost:8787/api/v1/health | jq '.'
    echo ""
    
    echo "3. Testing authentication..."
    # Test with mock auth token
    AUTH_HEADER="Authorization: Bearer mock-dev-token"
    
    # Test user endpoint
    echo "User Info:"
    curl -s -H "$AUTH_HEADER" http://localhost:8787/api/v1/auth/user | jq '.'
    echo ""
    
    echo "4. Testing data sources..."
    curl -s -H "$AUTH_HEADER" http://localhost:8787/api/v1/datasources | jq '.'
    echo ""
    
    echo "5. Creating sample data..."
    curl -s -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
        http://localhost:8787/api/v1/test/create-sample-data | jq '.'
    echo ""
    
    echo "6. Processing calculations..."
    curl -s -X POST -H "$AUTH_HEADER" \
        http://localhost:8787/api/v1/calculations | jq '.'
    echo ""
    
    echo "7. Viewing emissions summary..."
    curl -s -H "$AUTH_HEADER" \
        http://localhost:8787/api/v1/emissions/summary | jq '.'
    echo ""
    
    echo "🎉 Platform testing complete!"
    echo ""
    echo "Next steps:"
    echo "• View the dashboard: http://localhost:4321"
    echo "• Check API docs: http://localhost:8787"
    echo "• Set up external services (see setup guides)"
    
else
    echo "❌ API is not responding at http://localhost:8787"
    echo ""
    echo "Please start the development server first:"
    echo "npm run dev"
    echo ""
    echo "Or start just the API:"
    echo "cd apps/api && npm run dev"
fi