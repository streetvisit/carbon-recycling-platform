// @ts-check
import { defineConfig, envField } from 'astro/config';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import clerk from '@clerk/astro';

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PUBLIC_CLERK_PUBLISHABLE_KEY: envField.string({
        context: 'client',
        access: 'public',
        default: 'pk_test_placeholder_for_development'
      }),
      CLERK_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        default: 'sk_test_placeholder_for_development'
      }),
      PUBLIC_API_BASE_URL: envField.string({
        context: 'client', 
        access: 'public',
        default: 'https://api.carbon-recycling.com/api/v1'
      }),
      PUBLIC_ENV: envField.string({
        context: 'client',
        access: 'public', 
        default: 'production'
      })
    }
  },

  integrations: [
    preact(),
clerk({
      signInFallbackRedirectUrl: '/dashboard',
      signUpFallbackRedirectUrl: '/dashboard',
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      appearance: {
        baseTheme: undefined
      }
    })
  ],

  vite: {
    plugins: [tailwindcss()]
  },

  output: 'static', // Static site for Cloudflare Pages
});
