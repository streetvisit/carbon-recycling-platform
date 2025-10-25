// Quick script to check what keys are being used at build time
console.log('PUBLIC_CLERK_PUBLISHABLE_KEY:', process.env.PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 15) + '...')
console.log('Starts with pk_live?', process.env.PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_'))
console.log('Starts with pk_test?', process.env.PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_'))
