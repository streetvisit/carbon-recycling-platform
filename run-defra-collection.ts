#!/usr/bin/env npx ts-node

import 'reflect-metadata';
import { DEFRAConversionFactorsCollector } from './packages/uk-gov-data/defra-conversion-factors-collector';

async function main() {
  console.log('🚀 Starting DEFRA Conversion Factors Collection...');
  console.log('📝 This will collect ALL DEFRA conversion factors from 2002 to present');
  console.log('⏱️  Expected duration: 20-30 minutes for complete historical dataset');
  console.log('🔄 Progress will be shown below...\n');
  
  try {
    const collector = new DEFRAConversionFactorsCollector();
    
    console.log('🌐 Initializing DEFRA collector...');
    const startTime = Date.now();
    
    const result = await collector.collectAllConversionFactors();
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n🎉 DEFRA Collection Complete!');
    console.log('='.repeat(50));
    console.log(`📊 Total conversion factors: ${result.totalFactors.toLocaleString()}`);
    console.log(`📄 Total documents processed: ${result.totalDocuments}`);
    console.log(`📅 Years covered: ${result.yearsCovered.length} years (${Math.min(...result.yearsCovered)}-${Math.max(...result.yearsCovered)})`);
    console.log(`📂 Categories: ${result.categories.length} categories`);
    console.log(`📈 Trends identified: ${result.trends.length}`);
    console.log(`⏱️  Total duration: ${duration.toFixed(2)} seconds`);
    
    console.log('\n📂 Categories collected:');
    result.categories.forEach(category => {
      const count = Object.values(result.factorsByCategory[category] || {}).length;
      console.log(`   • ${category}: ${count} factors`);
    });
    
    if (result.trends.length > 0) {
      console.log('\n📈 Top 5 Conversion Factor Trends:');
      result.trends.slice(0, 5).forEach((trend, index) => {
        const arrow = trend.trend === 'increasing' ? '📈' : trend.trend === 'decreasing' ? '📉' : '➡️';
        console.log(`   ${index + 1}. ${trend.category}: ${arrow} ${trend.trend} (${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%)`);
      });
    }
    
    console.log('\n💾 Data saved to:');
    console.log('   • data/defra-conversion-factors/conversion-factors-database.json');
    console.log('   • data/defra-conversion-factors/conversion-factors-summary.json');
    console.log('   • data/defra-conversion-factors/raw-files/ (Excel files)');
    
    console.log('\n✨ Success! Your Carbon Recycling Platform now has access to:');
    console.log(`   • ${result.totalFactors.toLocaleString()} DEFRA conversion factors`);
    console.log(`   • ${result.yearsCovered.length} years of historical data`);
    console.log(`   • ${result.trends.length} trend analyses`);
    console.log('   • Complete compliance data for UK carbon reporting');
    
    return result;
    
  } catch (error: any) {
    console.error('\n💥 Error during DEFRA collection:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎯 DEFRA collection completed successfully!');
      console.log('🔄 Next: Run UK Government documentation collection');
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('\n❌ Collection failed:', error.message);
      process.exit(1);
    });
}