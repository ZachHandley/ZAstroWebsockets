// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from 'zastro-websockets-cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
    mode: 'compile'
  })
});