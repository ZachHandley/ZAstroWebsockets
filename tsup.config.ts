import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/integration.ts',
    'src/types.ts',
    'src/websocket.ts',
    'src/server.ts',
    'src/ws.ts',
    'src/patch-utils.ts',
    'src/response.ts',
    'src/dev-middleware.ts',
    'src/adapters/node-patched.ts',
    'src/adapters/cloudflare-patched.ts',
    // Build patched adapters if they exist
    'src/adapters/patched/node/index.ts',
    'src/adapters/patched/node/server.ts',
    'src/adapters/patched/node/preview.ts'
  ].filter(Boolean), // Filter out entries that don't exist
  format: ['esm'],
  dts: false, // Disable type generation to avoid DataCloneError
  splitting: false,
  sourcemap: true,
  clean: true, // Clean dist folder properly
  external: [
    'astro', 
    '@astrojs/node', 
    '@astrojs/cloudflare',
    'ws', 
    '@types/ws',
    'vite',
    'wrangler',
    'send',
    'server-destroy'
  ],
  target: 'node18'
})