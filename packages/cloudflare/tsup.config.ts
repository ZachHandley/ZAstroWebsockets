import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/adapter/index.ts',
    'src/entrypoints/server.ts',
    'src/entrypoints/image-endpoint.ts',
    'src/entrypoints/image-service.ts',
    'src/entrypoints/middleware.ts'
  ],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'astro',
    '@astrojs/internal-helpers/fs',
    '@astrojs/internal-helpers/path',
    '@astrojs/underscore-redirects',
    'tinyglobby',
    'vite',
    'wrangler',
    'cloudflare:workers'
  ],
  target: 'node18'
})