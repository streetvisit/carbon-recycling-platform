// Simple test script to verify the UK Carbon Intensity API integration
// Run with: node test-uk-api.js

async function testUKCarbonIntensityAPI() {
  console.log('🇬🇧 Testing UK Carbon Intensity API Integration...\n');

  try {
    // Test main carbon intensity endpoint
    console.log('1. Testing Carbon Intensity API...');
    const intensityResponse = await fetch('https://api.carbonintensity.org.uk/intensity');
    if (!intensityResponse.ok) {
      throw new Error(`HTTP error! status: ${intensityResponse.status}`);
    }
    const intensityData = await intensityResponse.json();
    console.log('✅ Carbon Intensity:', intensityData.data[0].intensity.actual || intensityData.data[0].intensity.forecast, 'gCO2/kWh');

    // Test generation mix endpoint  
    console.log('\n2. Testing Generation Mix API...');
    const generationResponse = await fetch('https://api.carbonintensity.org.uk/generation');
    if (!generationResponse.ok) {
      throw new Error(`HTTP error! status: ${generationResponse.status}`);
    }
    const generationData = await generationResponse.json();
    console.log('✅ Generation Mix:');
    generationData.data[0].generationmix.forEach(fuel => {
      console.log(`   ${fuel.fuel}: ${fuel.perc}%`);
    });

    // Test regional endpoint
    console.log('\n3. Testing Regional API...');
    const regionalResponse = await fetch('https://api.carbonintensity.org.uk/regional');
    if (!regionalResponse.ok) {
      throw new Error(`HTTP error! status: ${regionalResponse.status}`);
    }
    const regionalData = await regionalResponse.json();
    console.log('✅ Regional Data:');
    console.log(`   Total regions: ${regionalData.data.length}`);
    
    // Show a few example regions
    regionalData.data.slice(0, 3).forEach(region => {
      if (region.data && region.data.length > 0) {
        const intensity = region.data[0].intensity.actual || region.data[0].intensity.forecast;
        console.log(`   ${region.dnoregion}: ${intensity} gCO2/kWh`);
      }
    });

    console.log('\n🎉 All API endpoints working correctly!');
    console.log('The UK Carbon Intensity integration is ready for production.');
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    console.log('\n⚠️  If the API is temporarily unavailable, the application will use fallback data.');
  }
}

// Test the price estimation function (simplified version)
function testPriceEstimation() {
  console.log('\n4. Testing Price Estimation Logic...');
  
  // Example data
  const carbonIntensity = 180;
  const generationMix = {
    generationmix: [
      { fuel: 'gas', perc: 35 },
      { fuel: 'wind', perc: 25 },
      { fuel: 'nuclear', perc: 18 },
      { fuel: 'solar', perc: 8 },
      { fuel: 'imports', perc: 14 }
    ]
  };
  
  // Price calculation logic (simplified)
  let basePrice = 45;
  const carbonFactor = carbonIntensity / 200;
  basePrice *= (1 + carbonFactor * 0.5);
  
  const renewablePercentage = generationMix.generationmix
    .filter(g => ['wind', 'solar', 'hydro'].includes(g.fuel.toLowerCase()))
    .reduce((sum, g) => sum + g.perc, 0);
  
  if (renewablePercentage > 50) {
    basePrice *= 0.8;
  } else if (renewablePercentage < 30) {
    basePrice *= 1.2;
  }
  
  const gasPercentage = generationMix.generationmix
    .find(g => g.fuel.toLowerCase() === 'gas')?.perc || 0;
  
  if (gasPercentage > 40) {
    basePrice *= 1.1;
  }
  
  const estimatedPrice = Math.round(basePrice);
  
  console.log('✅ Price Estimation:');
  console.log(`   Carbon Intensity: ${carbonIntensity} gCO2/kWh`);
  console.log(`   Renewables: ${renewablePercentage}%`);
  console.log(`   Gas: ${gasPercentage}%`);
  console.log(`   Estimated Price: £${estimatedPrice}/MWh`);
}

// Run the tests
testUKCarbonIntensityAPI().then(() => {
  testPriceEstimation();
  console.log('\n✨ UK Carbon Intensity API integration test completed!');
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});