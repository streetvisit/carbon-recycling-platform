// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
// import clerk from '@clerk/astro';

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()]
  }
});
