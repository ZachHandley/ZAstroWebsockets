# zastro-websockets 🔌

Universal WebSocket support for Astro SSR Apps with **pre-patched adapters** - no manual patching required!

## Overview

ZAstroWebsockets is a monorepo containing WebSocket-enabled Astro adapters for Node.js and Cloudflare Workers. Each adapter is distributed as a separate package with WebSocket support built-in, eliminating the need for manual patching.

## Features

- ✅ **Pre-patched adapters**: Ships with WebSocket-enabled versions of Astro adapters
- ✅ **Multi-runtime support**: Node.js and Cloudflare Workers
- ✅ **Works with current Astro versions** (v4 & v5)
- ✅ **Unified API**: Same WebSocket API across all runtimes
- ✅ **TypeScript support**: Full type safety and IntelliSense
- ✅ **Drop-in replacement**: Simply replace your adapter import
- ✅ **Monorepo structure**: Separate packages for each runtime
- ✅ **Auto-versioning**: Synced with upstream Astro submodule

## Installation

Install the specific adapter package you need:

### For Node.js

```bash
npm install zastro-websockets-node
```

### For Cloudflare Workers

```bash
npm install zastro-websockets-cloudflare
```

## Usage

### Node.js Adapter

Replace your existing `@astrojs/node` import with the WebSocket-enabled version:

```js
// astro.config.mjs
import { defineConfig } from "astro/config"
import node from "zastro-websockets-node"

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
});
```

### Cloudflare Adapter

Replace your existing `@astrojs/cloudflare` import with the WebSocket-enabled version:

```js
// astro.config.mjs
import { defineConfig } from "astro/config"
import cloudflare from "zastro-websockets-cloudflare"

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
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

## Project Structure

This is a monorepo containing:

```
zastro-websockets/
├── packages/
│   ├── node/                    # zastro-websockets-node package
│   └── cloudflare/              # zastro-websockets-cloudflare package
├── tests/projects/              # Test projects for both adapters
├── patches/                     # Patch files for upstream Astro adapters
└── scripts/                     # Build and sync scripts
```

### Available Packages

- **`zastro-websockets-node`** - WebSocket-enabled Node.js adapter
- **`zastro-websockets-cloudflare`** - WebSocket-enabled Cloudflare Workers adapter

## TypeScript Support

Both packages provide full TypeScript support with proper type definitions:

```ts
// Types are automatically available in your Astro.locals
declare global {
  namespace App {
    interface Locals {
      isUpgradeRequest: boolean
      upgradeWebSocket(): { socket: WebSocket, response: Response }
      runtime?: any  // Runtime-specific context (Cloudflare only)
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
   - **Basic Stats**: `src/websocket/stats.ts` - Basic connection tracking and statistics
   - **Advanced Manager**: `src/websocket/connection-manager.ts` - Comprehensive connection lifecycle management
   - **Features**: 
     - Connection tracking with metadata (IP, User-Agent)
     - Connection pooling and limits
     - Rate limiting per IP address
     - Health monitoring and checks
     - Background cleanup services
     - Event-driven architecture
     - Graceful shutdown coordination
     - Custom cleanup policies

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


## Migration from Official Adapters

### From @astrojs/node

```diff
- import node from "@astrojs/node"
+ import node from "zastro-websockets-node"
```

### From @astrojs/cloudflare

```diff
- import cloudflare from "@astrojs/cloudflare"
+ import cloudflare from "zastro-websockets-cloudflare"
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

- ✅ **Node.js** (`zastro-websockets-node`) - Production ready
- ✅ **Cloudflare Workers** (`zastro-websockets-cloudflare`) - Production ready

> **Note**: The Deno adapter is no longer supported as it has been moved to the Deno organization. Please use the [official Deno adapter](https://github.com/denoland/deno-astro-adapter) for Deno deployments.

## Troubleshooting

### WebSocket connection fails
- Ensure you're using the correct adapter package (`zastro-websockets-node` or `zastro-websockets-cloudflare`)
- Check that your hosting environment supports WebSockets
- Verify the WebSocket URL matches your deployment

### TypeScript errors
- Make sure to import the adapter from the correct package name
- Update your `tsconfig.json` to include the package types
- Restart your TypeScript server after installation

### Development vs Production
- The adapters work in both development and production
- Additional logging is available in development mode
- Make sure to set `output: "server"` in your Astro config

### Package Issues
- If you're upgrading from the old single package, uninstall `zastro-websockets` first
- Install the specific adapter package you need (`zastro-websockets-node` or `zastro-websockets-cloudflare`)
- Update your import statements to use the new package names

## Advanced Configuration

### Runtime-Specific Features

#### Cloudflare Workers

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

#### Node.js

The Node.js adapter provides standard WebSocket functionality with full Node.js compatibility.

### Advanced Connection Management (Node.js)

The Node.js adapter includes a powerful ConnectionManager for production-grade WebSocket applications:

#### Basic Usage

```ts
import { ConnectionManagerAPI } from 'zastro-websockets-node/connection-manager';

// Get connection statistics
const stats = ConnectionManagerAPI.getStats();
console.log(`Active connections: ${stats.totalManagedConnections}`);

// Perform health checks
const healthResults = await ConnectionManagerAPI.healthCheck();

// Close connections by criteria
const closedCount = ConnectionManagerAPI.closeConnections({
  idleMoreThan: 300000, // Close connections idle for more than 5 minutes
  tags: ['temporary']   // Close connections tagged as temporary
});
```

#### Advanced Configuration

```ts
import { getConnectionManager } from 'zastro-websockets-node/connection-manager';

const manager = getConnectionManager({
  maxConnections: 1000,              // Global connection limit
  maxConnectionsPerIP: 10,           // Per-IP connection limit
  idleTimeout: 300000,               // 5 minutes idle timeout
  rateLimitWindow: 60000,            // 1 minute rate limit window
  rateLimitMaxConnections: 5,        // Max 5 connections per IP per minute
  enableHealthMonitoring: true,      // Enable automatic health checks
  customCleanupPolicy: (connection) => {
    // Custom logic for connection cleanup
    return connection.tags.has('temporary') && connection.age > 300000;
  }
});

// Event listeners for monitoring
manager.on('connection:added', (connection) => {
  console.log(`New connection: ${connection.id}`);
});

manager.on('pool:full', (rejected) => {
  console.warn(`Connection pool full, rejected: ${rejected.ip}`);
});

manager.on('ratelimit:exceeded', (ip, attempts) => {
  console.warn(`Rate limit exceeded for ${ip}`);
});
```

#### Connection Tagging and Metadata

```ts
// In your WebSocket route
socket.addEventListener('open', () => {
  const connectionId = getConnectionId(socket);
  if (connectionId) {
    // Add tags for grouping
    manager.addConnectionTag(connectionId, 'user-session');
    manager.addConnectionTag(connectionId, 'real-time-updates');
    
    // Store custom metadata
    manager.setConnectionData(connectionId, 'userId', user.id);
    manager.setConnectionData(connectionId, 'sessionStart', Date.now());
  }
});

// Later, find connections by criteria
const userSessions = manager.getConnectionsByTag('user-session');
const temporaryConnections = manager.getConnectionsByTag('temporary');
```

#### Health Monitoring

```ts
// Manual health check
const result = await manager.performHealthCheck(connectionId);
if (!result.healthy) {
  console.warn(`Connection ${connectionId} is unhealthy: ${result.error}`);
}

// Automatic background health monitoring
manager.on('connection:health', (connectionId, result) => {
  if (!result.healthy) {
    console.warn(`Health check failed for ${connectionId}: ${result.error}`);
  }
});
```

#### Graceful Shutdown

```ts
// Graceful shutdown with timeout
await ConnectionManagerAPI.shutdown({
  timeout: 10000,              // 10 second timeout
  closeCode: 1001,             // WebSocket close code
  closeReason: 'Server shutting down'
});
```

## Examples

Check out the test projects for complete working examples:
- `/tests/projects/node` - Node.js WebSocket implementation
- `/tests/projects/cloudflare` - Cloudflare Workers WebSocket implementation
- `/example-usage.md` - Detailed usage guide with examples
- `/example-websocket.ts` - Basic WebSocket server example
- `/example-cloudflare-websocket.ts` - Cloudflare-specific example
- `/example-connection-management.ts` - Basic connection tracking and cleanup
- `/example-advanced-connection-management.ts` - Advanced connection management with pooling, rate limiting, and health monitoring

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
pnpm install
pnpm run build
```

## Development Guide

### How the Build System Works

This project uses a **dynamic build system** that automatically applies WebSocket patches to upstream Astro adapters. Here's how it works:

#### 1. Project Structure
```
zastro-websockets/
├── astro-upstream/               # Git submodule of official Astro repo
├── packages/
│   ├── node/                    # Built Node.js adapter (generated)
│   │   ├── dist/               # Built TypeScript files
│   │   ├── src/                # Copied & modified upstream source
│   │   └── package.json        # Modified package.json
│   └── cloudflare/             # Built Cloudflare adapter (generated)
│       ├── dist/               # Built TypeScript files
│       ├── src/                # Copied & modified upstream source
│       └── package.json        # Modified package.json
├── patches/                     # Legacy patch files (reference only)
├── scripts/                     # Build automation scripts
│   ├── dynamic-build.ts        # Main build orchestrator
│   ├── dynamic-build-node.ts   # Node.js adapter build script
│   └── dynamic-build-cloudflare.ts # Cloudflare adapter build script
└── tests/projects/             # Test projects for both adapters
```

#### 2. Build Process Overview

The build system uses a **5-step process** for each adapter:

1. **Copy Upstream** → Copy source files from `astro-upstream/packages/integrations/[adapter]` to `packages/[adapter]/`
2. **Apply Modifications** → Apply all WebSocket patch modifications as code transformations
3. **Update Package.json** → Change package name and add WebSocket dependencies
4. **Install Dependencies** → Install dependencies in the local copy
5. **Build Locally** → Compile TypeScript to create the final `dist/` folder

#### 3. Key Build Scripts

**Main Build Script: `scripts/dynamic-build.ts`**
- Orchestrates the entire build process
- Cleans upstream and installs dependencies
- Runs both Node.js and Cloudflare builds sequentially

**Node.js Build: `scripts/dynamic-build-node.ts`**
- Copies upstream Node.js adapter source
- Applies all WebSocket modifications from the original patch
- Creates WebSocket files: `websocket/`, `middleware/`
- Adds `ws` dependency and WebSocket exports
- Builds standalone TypeScript project

**Cloudflare Build: `scripts/dynamic-build-cloudflare.ts`**
- Copies upstream Cloudflare adapter source  
- Applies WebSocket modifications for Cloudflare Workers
- Creates WebSocket files and entrypoint modifications
- Adds WebSocket export to package.json
- Builds standalone TypeScript project

#### 4. Available Scripts

```bash
# Full build process (recommended)
pnpm run build

# Build only upstream Astro (without adapters)
pnpm run build:upstream

# Build only the adapters (after upstream is built)
pnpm run build:adapters

# Test the Node.js adapter
pnpm run test:node

# Test the Cloudflare adapter  
pnpm run test:cloudflare

# Test both adapters
pnpm run test

# Reset the astro-upstream submodule
pnpm run reset
```

#### 5. How Patches Are Applied

Instead of using Git patches, the build system applies modifications **as code transformations**:

**For Node.js Adapter:**
- Modifies `serve-app.ts` to add WebSocket upgrade handling
- Modifies `standalone.ts` to add WebSocket server integration
- Modifies `types.ts` to export WebSocket types
- Modifies `index.ts` to change package name references
- Creates complete WebSocket implementation files

**For Cloudflare Adapter:**
- Modifies `index.ts` to change package name references
- Creates WebSocket implementation files for Cloudflare Workers
- Adds WebSocket export to package.json

#### 6. Development Workflow

1. **Make Changes to Build Scripts**
   - Edit `scripts/dynamic-build-node.ts` for Node.js changes
   - Edit `scripts/dynamic-build-cloudflare.ts` for Cloudflare changes

2. **Test Your Changes**
   ```bash
   pnpm run build
   pnpm run test
   ```

3. **Debug Build Issues**
   - Check `packages/node/` and `packages/cloudflare/` for generated files
   - Review TypeScript errors in build output
   - Verify WebSocket files are created correctly

4. **Update Tests**
   - Test projects are in `tests/projects/`
   - Update test projects to match API changes

#### 7. Key Differences from Patch-Based Approach

| Aspect | Old Patch System | New Dynamic System |
|--------|------------------|-------------------|
| **Modification Method** | Git patches | Code transformations |
| **Build Location** | Upstream directory | Local packages/ directory |
| **Dependency Management** | Workspace conflicts | Isolated local dependencies |
| **TypeScript Compilation** | Upstream tsconfig | Custom standalone tsconfig |
| **Maintenance** | Manual patch updates | Automated code generation |
| **Debugging** | Patch application errors | Clear TypeScript errors |

#### 8. Adding New Features

To add new WebSocket features:

1. **Update the build scripts** to include your new files/modifications
2. **Add the files to the appropriate `createWebSocketFiles()` function**
3. **Update package.json exports** if needed
4. **Test the build process** with `pnpm run build`
5. **Update the test projects** to demonstrate the new features

#### 9. Troubleshooting Development Issues

**Build Fails with TypeScript Errors:**
- Check that all imports are correctly resolved
- Verify workspace dependencies are properly linked
- Ensure tsconfig.json has correct module resolution

**Missing WebSocket Files:**
- Check that `createWebSocketFiles()` creates all necessary files
- Verify file paths and exports are correct
- Ensure TypeScript compilation includes all source files

**Dependency Resolution Issues:**
- Verify that `@astrojs/internal-helpers` is properly linked
- Check that all required dependencies are installed
- Ensure package.json has correct dependency versions

This dynamic build system eliminates the need for manual patch management while providing more flexibility and reliability than the previous patch-based approach.

## License

MIT - see LICENSE file for details.

## Credits

This package is inspired by:
- [gratelets](https://github.com/gratelets/gratelets) - For the pre-patched adapter approach
- [astro-node-websocket](https://github.com/lilnasy/gratelets/tree/main/packages/node-websocket) - Original WebSocket integration concept
- The Astro team for the excellent framework and adapter architecture

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.