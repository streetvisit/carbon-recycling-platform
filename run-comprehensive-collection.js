#!/usr/bin/env node

// Import required modules
require('reflect-metadata');

// Simple polyfill for NestJS Logger if needed
if (!global.console.log.bind) {
  const originalLog = console.log;
  console.log = (...args) => originalLog(...args);
}

// Mock NestJS Logger for standalone execution
class SimpleLogger {
  log(...args) { console.log('📝', ...args); }
  error(...args) { console.error('❌', ...args); }
  warn(...args) { console.warn('⚠️', ...args); }
}

// Create a mock Injectable decorator
function Injectable() {
  return function(target) {
    return target;
  };
}

// Create global mocks
global.Injectable = Injectable;

// Now import and run our comprehensive collection
async function runCollection() {
  try {
    console.log('🚀 Starting UK Government & DEFRA Comprehensive Data Collection...');
    
    // We'll need to require the modules and run them
    // For now, let's start with a simple test to make sure our modules can be loaded
    
    const { UKGovernmentDocumentationService } = require('./packages/uk-gov-data/documentation-service');
    const { DEFRAConversionFactorsCollector } = require('./packages/uk-gov-data/defra-conversion-factors-collector');
    
    console.log('✅ Modules loaded successfully');
    console.log('📊 Initializing DEFRA Conversion Factors Collector...');
    
    const defraCollector = new DEFRAConversionFactorsCollector();
    
    console.log('🌐 Starting DEFRA conversion factors collection...');
    console.log('📝 Note: This may take 20-30 minutes to collect all historical data (2002-present)');
    console.log('🔄 Progress will be shown below...\n');
    
    const result = await defraCollector.collectAllConversionFactors();
    
    console.log('\n🎉 DEFRA Collection Results:');
    console.log(`📊 Total conversion factors: ${result.totalFactors}`);
    console.log(`📄 Total documents processed: ${result.totalDocuments}`);
    console.log(`📅 Years covered: ${result.yearsCovered.length} years (${Math.min(...result.yearsCovered)}-${Math.max(...result.yearsCovered)})`);
    console.log(`📂 Categories: ${result.categories.length} categories`);
    console.log(`📈 Trends identified: ${result.trends.length}`);
    
    if (result.trends.length > 0) {
      console.log('\n📈 Top Trends:');
      result.trends.slice(0, 5).forEach(trend => {
        console.log(`   ${trend.category}: ${trend.trend} (${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%)`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('💥 Error during collection:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the collection
if (require.main === module) {
  runCollection()
    .then(() => {
      console.log('\n✅ Comprehensive data collection completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Collection failed:', error.message);
      process.exit(1);
    });
}