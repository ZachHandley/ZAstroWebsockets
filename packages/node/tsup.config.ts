import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/adapter/index.ts',
    'src/adapter/server.ts',
    'src/adapter/preview.ts',
    'src/websocket/dev-middleware.ts',
    'src/websocket/stats.ts',
    'src/websocket/connection-manager.ts',
    'src/middleware/index.ts'
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
    'ws',
    '@types/ws',
    'bufferutil',
    'send',
    'server-destroy',
    'tinyglobby',
    'vite'
  ],
  target: 'node18'
})