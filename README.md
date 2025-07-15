# zastro-websockets 🔌

Universal WebSocket support for Astro SSR Apps with **pre-patched adapters** - no manual patching required!

## Overview

The `zastro-websockets` package provides WebSocket support for your Astro project by shipping **pre-patched** versions of official Astro adapters. This approach, inspired by [gratelets](https://github.com/gratelets/gratelets), eliminates the need for manual patching and provides a more reliable solution.

## Features

- ✅ **Pre-patched adapters**: Ships with WebSocket-enabled versions of Astro adapters
- ✅ **Multi-runtime support**: Node.js and Cloudflare Workers
- ✅ **Works with current Astro versions** (v4 & v5)
- ✅ **Unified API**: Same WebSocket API across all runtimes
- ✅ **TypeScript support**: Full type safety and IntelliSense
- ✅ **Drop-in replacement**: Simply replace your adapter import
- ✅ **Connection management**: Built-in connection tracking and cleanup
- ✅ **Auto-versioning**: Synced with upstream Astro submodule

## Installation

```bash
npm install zastro-websockets
```

## Usage

### Node.js Adapter

Replace your existing `@astrojs/node` import with the pre-patched version:

```js
// astro.config.mjs
import { defineConfig } from "astro/config"
import node from "zastro-websockets/node"  // Pre-patched version

export default defineConfig({
  adapter: node({ mode: "standalone" }),
  // No additional integrations needed!
});
```

### Cloudflare Adapter

Replace your existing `@astrojs/cloudflare` import with the pre-patched version:

```js
// astro.config.mjs
import { defineConfig } from "astro/config"
import cloudflare from "zastro-websockets/cloudflare"  // Pre-patched version

export default defineConfig({
  adapter: cloudflare(),
  // No additional integrations needed!
});
```


## WebSocket API

The WebSocket API is consistent across all runtimes:

### API Routes

```ts
// src/pages/api/ws.ts
import type { APIRoute } from "astro"

export const GET: APIRoute = (ctx) => {
  // Check if this is a WebSocket upgrade request
  if (ctx.locals.isUpgradeRequest) {
    // Upgrade the connection to a WebSocket
    const { response, socket } = ctx.locals.upgradeWebSocket()
    
    // Set up your WebSocket handlers
    socket.onopen = () => {
      console.log("WebSocket connection opened")
    }
    
    socket.onmessage = (event) => {
      console.log("Received:", event.data)
      if (event.data === "ping") {
        socket.send("pong")
      }
    }
    
    socket.onclose = () => {
      console.log("WebSocket connection closed")
    }
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }
    
    // Return the upgrade response
    return response
  }
  
  // Return error for non-WebSocket requests
  return new Response("Upgrade required", { status: 426 })
}
```

### Client-side JavaScript

```html
<!-- src/pages/index.astro -->
<script>
  const ws = new WebSocket("ws://localhost:4321/api/ws")
  
  ws.onopen = () => {
    console.log("Connected to WebSocket")
    ws.send("Hello, Server!")
  }
  
  ws.onmessage = (event) => {
    console.log("Received:", event.data)
  }
  
  ws.onclose = () => {
    console.log("Disconnected from WebSocket")
  }
</script>
```

## Connection Management

ZAstroWebsockets includes built-in connection tracking and cleanup features:

### Connection Statistics

```ts
// src/pages/api/stats.ts
import { WebSocketStats } from "zastro-websockets/node"

export const GET = () => {
  const stats = WebSocketStats.getConnectionStats()
  return new Response(JSON.stringify({
    activeConnections: stats.totalConnections,
    connections: stats.connections.map(conn => ({
      age: Math.round(conn.age / 1000) + 's',
      idle: Math.round(conn.idleTime / 1000) + 's',
      ip: conn.remoteAddress
    }))
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### Connection Cleanup

```ts
// Automatic cleanup runs every 30 seconds
// Connections idle for 5+ minutes are automatically closed

// Manual cleanup
import { WebSocketStats } from "zastro-websockets/node"

// Get connection count
const count = WebSocketStats.getConnectionCount()

// Close all connections
WebSocketStats.closeAllConnections()

// Graceful shutdown
WebSocketStats.shutdown()
```

### Middleware Integration

```ts
// src/middleware.ts
import { createStatsMiddleware } from "zastro-websockets/node"

export const onRequest = createStatsMiddleware()

// Now all pages have access to connection stats in Astro.locals.websocketStats
```

## TypeScript Support

The package provides full TypeScript support with proper type definitions:

```ts
// Types are automatically available in your Astro.locals
declare global {
  namespace App {
    interface Locals {
      isUpgradeRequest: boolean
      upgradeWebSocket(): { socket: WebSocket, response: Response }
      runtime?: any  // Runtime-specific context (Cloudflare only)
      websocketStats?: {
        connectionCount: number
        getStats: () => any
        getActiveConnections: () => Set<WebSocket>
      }
    }
  }
}
```

## How the Adapter Patches Work

### Node.js Adapter Architecture

The Node.js adapter patch consists of a **single comprehensive patch** that integrates WebSocket support:

#### Patch Structure
```
patches/node/v5/websocket-support.patch
```

#### What the Patch Does

1. **Adds WebSocket Dependencies**
   - Adds `ws` and `@types/ws` to package.json
   - Integrates WebSocket server with existing HTTP server

2. **WebSocket Server Integration**
   ```typescript
   // Creates WebSocket server alongside HTTP server
   const wsServer = new ws.WebSocketServer({ noServer: true })
   
   // Handles HTTP upgrade requests
   httpServer.on('upgrade', (req, socket, head) => {
     wsServer.handleUpgrade(req, socket, head, (ws) => {
       // Attach WebSocket to standardized interface
       attach(websocket, ws, metadata)
     })
   })
   ```

3. **WebSocket Wrapper Implementation**
   - **File**: `src/adapters/patched/node/websocket/websocket.ts`
   - **Purpose**: Provides browser-compatible WebSocket API
   - **Features**: Event handling, message sending, connection state management

4. **Connection Management**
   - **File**: `src/adapters/patched/node/websocket/connection-manager.ts`
   - **Features**: 
     - Connection tracking with metadata (IP, User-Agent)
     - Automatic cleanup of stale connections
     - Statistics and monitoring
     - Graceful shutdown handling

5. **Development vs Production**
   - **Development**: Uses `dev-middleware.ts` for Vite integration
   - **Production**: Uses `serve-websocket.ts` for standalone server

### Cloudflare Adapter Architecture

The Cloudflare adapter uses a **single comprehensive patch** that integrates WebSocket support:

#### Patch Structure
```
patches/cloudflare/v5/cloudflare-websocket-support.patch
```

#### What the Patch Does

1. **Adds WebSocket Export**
   - Adds `./websocket` export to package.json
   - Enables access to WebSocket utilities

2. **WebSocket Implementation**
   ```typescript
   // Uses Cloudflare's WebSocketPair API
   const { 0: client, 1: server } = new WebSocketPair()
   
   // Create upgrade response
   const response = createWebSocketResponse(client)
   
   // Return wrapped server socket
   return { socket: new CloudflareWebSocket(server), response }
   ```

3. **Development vs Production**
   - **Development**: Uses `DevWebSocket` with echo functionality
   - **Production**: Uses native Cloudflare WebSocket API
   - **Middleware**: Auto-runs on dev server for seamless development

4. **WebSocket Wrapper Classes**
   - **`CloudflareWebSocket`**: Production wrapper for native WebSocket
   - **`DevWebSocket`**: Development simulation with same API
   - **`UpgradeResponse`**: Proper HTTP 101 upgrade response

### Build Process

The build process applies patches automatically:

```javascript
// scripts/build-patched-adapters.js
const patches = {
  node: 'patches/node/v5/websocket-support.patch',
  cloudflare: 'patches/cloudflare/v5/cloudflare-websocket-support.patch'
}

// 1. Apply patches to astro-upstream submodule
// 2. Build patched adapters
// 3. Copy to dist directory
// 4. Export through package.json
```

### Version Management

The package uses automatic version syncing with the Astro submodule:

```javascript
// scripts/sync-version.js
const astroVersion = getAstroVersion()
const submoduleCommit = getSubmoduleCommit()
const newVersion = `${astroVersion}-${submoduleCommit.substring(0, 7)}`

// Version format: 5.7.13-2dbf999
```

## Runtime-Specific Features

### Cloudflare Workers

When using the Cloudflare adapter, you get access to the runtime context:

```ts
export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { response, socket } = ctx.locals.upgradeWebSocket()
    
    // Access Cloudflare runtime features
    const env = ctx.locals.runtime?.env
    const cf = ctx.locals.runtime?.cf
    
    // Use Cloudflare-specific features
    const kv = env.MY_KV_NAMESPACE
    const country = cf.country
    
    return response
  }
  
  return new Response("Upgrade required", { status: 426 })
}
```

### Node.js

The Node.js adapter provides standard WebSocket functionality with full Node.js compatibility:

```ts
import { WebSocketStats, logConnectionStats } from "zastro-websockets/node"

// Connection management
const stats = WebSocketStats.getConnectionStats()
console.log(`Active connections: ${stats.totalConnections}`)

// Graceful shutdown
process.on('SIGINT', () => {
  WebSocketStats.closeAllConnections()
  WebSocketStats.shutdown()
  process.exit(0)
})
```

## Migration from Official Adapters

### From @astrojs/node

```diff
- import node from "@astrojs/node"
+ import node from "zastro-websockets/node"
```

### From @astrojs/cloudflare

```diff
- import cloudflare from "@astrojs/cloudflare"
+ import cloudflare from "zastro-websockets/cloudflare"
```

That's it! No other changes needed.

## Comparison with Manual Patching

| Feature | Manual Patching | zastro-websockets |
|---------|----------------|-------------------|
| Setup complexity | High (manual patch application) | Low (just change import) |
| Reliability | Depends on patch compatibility | High (pre-tested combinations) |
| Updates | Manual re-patching required | Automatic with package updates |
| Maintenance | User responsibility | Package maintainer responsibility |
| Risk | Patches might break on updates | Version-locked compatibility |
| Connection Management | Manual implementation | Built-in tracking and cleanup |

## Available Adapters

- ✅ **Node.js** (`zastro-websockets/node`) - Production ready
- ✅ **Cloudflare Workers** (`zastro-websockets/cloudflare`) - Production ready

> **Note**: The Deno adapter is no longer supported as it has been moved to the Deno organization. Please use the [official Deno adapter](https://github.com/denoland/deno-astro-adapter) for Deno deployments.

## Troubleshooting

### WebSocket connection fails
- Ensure you're using the pre-patched adapter from `zastro-websockets/*`
- Check that your hosting environment supports WebSockets
- Verify the WebSocket URL matches your deployment

### Connection Management Issues
- Check connection stats with `WebSocketStats.getConnectionStats()`
- Ensure proper cleanup in your application shutdown handlers
- Monitor connection logs for idle timeout messages

### TypeScript errors
- Make sure to import the adapter from the correct path
- Update your `tsconfig.json` to include the package types
- Restart your TypeScript server after installation

### Development vs Production
- The adapters work in both development and production
- In development, additional logging is available with the optional integration
- Connection cleanup intervals may be different in development mode

### Patch Application Issues
- Check that the `astro-upstream` submodule is properly initialized
- Verify patch files exist in the `patches/` directory
- Run the build process manually if needed: `npm run build:adapters`

## Advanced Configuration

### Custom Connection Limits

```ts
// src/middleware.ts
import { connectionManager } from "zastro-websockets/node"

export const onRequest = async (context, next) => {
  const connectionCount = connectionManager.getActiveConnectionCount()
  
  if (connectionCount > 100) {
    return new Response("Too many connections", { status: 503 })
  }
  
  return next()
}
```

### Connection Monitoring

```ts
// src/pages/admin/websocket-monitor.ts
import { WebSocketStats, logConnectionStats } from "zastro-websockets/node"

export const GET = () => {
  const stats = WebSocketStats.getConnectionStats()
  
  return new Response(JSON.stringify({
    totalConnections: stats.totalConnections,
    oldestConnection: Math.max(...stats.connections.map(c => c.age)),
    averageIdleTime: stats.connections.reduce((sum, c) => sum + c.idleTime, 0) / stats.connections.length
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Examples

Check out the `/examples` directory for complete working examples:
- Node.js WebSocket server with connection management
- Cloudflare Workers WebSocket handling
- Real-time chat application
- Connection monitoring dashboard

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create your feature branch
3. Add tests for your changes
4. Update documentation
5. Submit a pull request

### Development Setup

```bash
git clone https://github.com/zachhandley/zastro-websockets.git
cd zastro-websockets
git submodule update --init --recursive
npm install
npm run build
```

## License

MIT - see LICENSE file for details.

## Credits

This package is inspired by:
- [gratelets](https://github.com/gratelets/gratelets) - For the pre-patched adapter approach
- [astro-node-websocket](https://github.com/lilnasy/gratelets/tree/main/packages/node-websocket) - Original WebSocket integration concept
- The Astro team for the excellent framework and adapter architecture

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.