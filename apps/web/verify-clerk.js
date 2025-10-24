#!/usr/bin/env node
/**
 * Clerk Configuration Verification Script
 * Run this to verify your Clerk environment variables are set correctly
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔐 Clerk Configuration Verification\n');
console.log('=' .repeat(50));

// Read .env file
try {
  const envPath = join(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');
  
  const config = {};
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      config[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  // Check PUBLIC_CLERK_PUBLISHABLE_KEY
  console.log('\n📌 PUBLIC_CLERK_PUBLISHABLE_KEY:');
  if (config.PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const key = config.PUBLIC_CLERK_PUBLISHABLE_KEY;
    
    if (key.startsWith('pk_test_')) {
      console.log('   ✅ Found: Development/Test key');
      console.log(`   🔑 ${key.substring(0, 20)}...`);
      console.log('   ⚠️  Using TEST keys - suitable for development only');
    } else if (key.startsWith('pk_live_')) {
      console.log('   ✅ Found: Production/Live key');
      console.log(`   🔑 ${key.substring(0, 20)}...`);
      console.log('   ✨ Using LIVE keys - ready for production!');
    } else {
      console.log('   ❌ Invalid key format');
      console.log(`   🔑 ${key.substring(0, 30)}...`);
      console.log('   ⚠️  Key should start with pk_test_ or pk_live_');
    }
  } else {
    console.log('   ❌ NOT FOUND');
    console.log('   💡 Add PUBLIC_CLERK_PUBLISHABLE_KEY to .env file');
  }
  
  // Check CLERK_SECRET_KEY
  console.log('\n📌 CLERK_SECRET_KEY:');
  if (config.CLERK_SECRET_KEY) {
    const key = config.CLERK_SECRET_KEY;
    
    if (key.startsWith('sk_test_')) {
      console.log('   ✅ Found: Development/Test key');
      console.log(`   🔑 ${key.substring(0, 20)}...`);
      console.log('   ⚠️  Using TEST keys - suitable for development only');
    } else if (key.startsWith('sk_live_')) {
      console.log('   ✅ Found: Production/Live key');
      console.log(`   🔑 ${key.substring(0, 20)}...`);
      console.log('   ✨ Using LIVE keys - ready for production!');
    } else {
      console.log('   ❌ Invalid key format');
      console.log(`   🔑 ${key.substring(0, 30)}...`);
      console.log('   ⚠️  Key should start with sk_test_ or sk_live_');
    }
  } else {
    console.log('   ❌ NOT FOUND');
    console.log('   💡 Add CLERK_SECRET_KEY to .env file');
  }
  
  // Key matching check
  console.log('\n📌 KEY CONSISTENCY:');
  const pubKey = config.PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const secKey = config.CLERK_SECRET_KEY || '';
  
  const pubIsTest = pubKey.startsWith('pk_test_');
  const pubIsLive = pubKey.startsWith('pk_live_');
  const secIsTest = secKey.startsWith('sk_test_');
  const secIsLive = secKey.startsWith('sk_live_');
  
  if ((pubIsTest && secIsTest) || (pubIsLive && secIsLive)) {
    console.log('   ✅ Keys match (both test or both live)');
  } else if (pubKey && secKey) {
    console.log('   ⚠️  WARNING: Publishable and Secret keys don\'t match!');
    console.log('   💡 Both should be test keys OR both should be live keys');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 SUMMARY:\n');
  
  const hasValidPublishable = pubKey.startsWith('pk_test_') || pubKey.startsWith('pk_live_');
  const hasValidSecret = secKey.startsWith('sk_test_') || secKey.startsWith('sk_live_');
  const keysMatch = (pubIsTest && secIsTest) || (pubIsLive && secIsLive);
  
  if (hasValidPublishable && hasValidSecret && keysMatch) {
    console.log('   ✅ Clerk is properly configured!');
    console.log('   🚀 Authentication should work');
    
    if (pubIsTest) {
      console.log('\n   💡 Next step: Deploy with LIVE keys for production');
      console.log('      Add them to Cloudflare Pages environment variables');
    }
  } else {
    console.log('   ❌ Clerk configuration needs attention');
    console.log('\n   📖 Follow these steps:');
    console.log('      1. Go to https://dashboard.clerk.com');
    console.log('      2. Get your API keys from the dashboard');
    console.log('      3. Update your .env file:');
    console.log('         PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...');
    console.log('         CLERK_SECRET_KEY=sk_test_...');
    console.log('      4. For production, add LIVE keys to Cloudflare Pages');
    console.log('\n   📄 See CLERK_SETUP.md for detailed instructions');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
} catch (error) {
  console.error('❌ Error reading .env file:', error.message);
  console.log('\n💡 Make sure you have a .env file in apps/web/');
  console.log('   Copy .env.example to .env and add your Clerk keys\n');
  process.exit(1);
}
