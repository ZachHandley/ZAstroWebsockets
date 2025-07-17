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

## How the Dynamic Build System Works

### Modern Code-Transformation Approach

Instead of maintaining fragile patch files, **ZAstroWebsockets uses a modern dynamic build system** that applies WebSocket modifications as **code transformations** directly to the upstream Astro source code.

### Node.js Adapter Architecture

The Node.js adapter build system performs **live code modifications** to integrate WebSocket support:

#### Build Process Steps

1. **Copy Upstream Source**
   - Copies fresh source from `astro-upstream/packages/integrations/node/`
   - Maintains sync with latest Astro releases

2. **Apply Code Transformations**
   - **Modifies `serve-app.ts`**: Adds WebSocket upgrade handling
   - **Modifies `standalone.ts`**: Integrates WebSocket server with HTTP server
   - **Modifies `types.ts`**: Exports WebSocket types
   - **Modifies `index.ts`**: Updates package name references
   - **Creates WebSocket Files**: Complete WebSocket implementation

3. **WebSocket Server Integration**
   ```typescript
   // Dynamically injected into serve-app.ts
   const wsServer = new ws.WebSocketServer({ noServer: true })
   
   // Handles HTTP upgrade requests
   httpServer.on('upgrade', (req, socket, head) => {
     wsServer.handleUpgrade(req, socket, head, (ws) => {
       attach(websocket, ws, metadata)
     })
   })
   ```

4. **Generated WebSocket Files**
   - **`websocket/index.ts`**: Main WebSocket wrapper with browser-compatible API
   - **`websocket/stats.ts`**: Connection tracking and statistics
   - **`websocket/connection-manager.ts`**: Advanced connection lifecycle management
   - **`websocket/attach.ts`**: WebSocket attachment utilities
   - **`websocket/dev-middleware.ts`**: Development server integration
   - **`websocket/serve-websocket.ts`**: Production server integration

5. **Package Configuration**
   - **Adds Dependencies**: `ws@^8.18.0` and `@types/ws@^8.5.12`
   - **Adds Exports**: `./websocket` and `./stats` exports
   - **Resolves Workspace Deps**: Converts `@astrojs/internal-helpers@workspace:*` to actual versions

### Cloudflare Adapter Architecture

The Cloudflare adapter uses the same **dynamic transformation approach**:

#### Build Process Steps

1. **Copy Upstream Source**
   - Copies fresh source from `astro-upstream/packages/integrations/cloudflare/`
   - Maintains compatibility with Cloudflare Workers runtime

2. **Apply Code Transformations**
   - **Modifies `index.ts`**: Updates package name references
   - **Creates WebSocket Files**: Cloudflare Workers-specific implementation

3. **WebSocket Implementation**
   ```typescript
   // Dynamically generated in websocket/index.ts
   export function upgradeWebSocket(): WebSocketUpgrade {
     // Uses Cloudflare's WebSocketPair API
     const { 0: client, 1: server } = new WebSocketPair()
     
     // Create upgrade response
     const response = createWebSocketResponse(client)
     
     // Return wrapped server socket
     return { socket: new CloudflareWebSocket(server), response }
   }
   ```

4. **Generated WebSocket Files**
   - **`websocket/index.ts`**: Main WebSocket implementation for Cloudflare Workers
   - **`websocket/response.ts`**: HTTP upgrade response handling
   - **`websocket/websocket.ts`**: WebSocket wrapper classes
   - **`websocket/dev-middleware.ts`**: Development server simulation

5. **WebSocket Wrapper Classes**
   - **`CloudflareWebSocket`**: Production wrapper for native WebSocket
   - **`DevWebSocket`**: Development simulation with same API
   - **`UpgradeResponse`**: Proper HTTP 101 upgrade response

### Build System Architecture

The build system uses **3 main scripts**:

```typescript
// scripts/dynamic-build.ts - Main orchestrator
export function buildAll() {
  // 1. Clean and prepare upstream
  // 2. Install upstream dependencies
  // 3. Build Node.js adapter
  // 4. Build Cloudflare adapter
  // 5. Copy README.md to packages
}

// scripts/dynamic-build-node.ts - Node.js specific
export function buildNodeAdapter() {
  // 1. Copy upstream source
  // 2. Apply all WebSocket modifications
  // 3. Update package.json and resolve dependencies
  // 4. Build TypeScript locally
}

// scripts/dynamic-build-cloudflare.ts - Cloudflare specific  
export function buildCloudflareAdapter() {
  // 1. Copy upstream source
  // 2. Apply WebSocket modifications
  // 3. Update package.json
  // 4. Build TypeScript locally
}
```

### Automatic Version Management

The build system uses **adapter-specific versioning**:

```javascript
// GitHub Actions workflow
const nodeAdapterVersion = require('./packages/integrations/node/package.json').version
const cloudflareAdapterVersion = require('./packages/integrations/cloudflare/package.json').version
const ourCommit = process.env.GITHUB_SHA.substring(0, 7)

// Version format: 8.3.4-abc1234 (adapter version + our commit)
const finalVersion = `${nodeAdapterVersion}-${ourCommit}`
```

### Key Advantages of Dynamic Build System

| Aspect | Old Patch System | New Dynamic System |
|--------|------------------|-------------------|
| **Reliability** | Patches break on updates | Code transformations adapt |
| **Maintenance** | Manual patch updates | Automated code generation |
| **Debugging** | Patch application errors | Clear TypeScript errors |
| **Dependency Management** | Workspace conflicts | Isolated local dependencies |
| **Build Speed** | Slow patch application | Fast code transformations |
| **Flexibility** | Limited to patch changes | Full code control |


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
│   ├── dynamic-build-cloudflare.ts # Cloudflare adapter build script
│   └── reset-submodule.ts      # Submodule management
└── tests/projects/             # Test projects for both adapters
```

#### 2. Build Process Overview

The build system uses a **6-step process** for each adapter:

1. **Copy Upstream Source** → Copy source files from `astro-upstream/packages/integrations/[adapter]` to `packages/[adapter]/`
2. **Apply Code Transformations** → Apply all WebSocket modifications as live code transformations
3. **Update Package.json** → Change package name, add WebSocket dependencies, resolve workspace dependencies
4. **Install Dependencies** → Install dependencies in upstream workspace (with `--no-frozen-lockfile`)
5. **Build Upstream** → Compile TypeScript in upstream workspace
6. **Copy Built Files** → Copy compiled `dist/` and modified `package.json` to final packages + README.md

#### 3. Key Build Scripts

**Main Build Script: `scripts/dynamic-build.ts`**
- Orchestrates the entire build process
- Cleans upstream and installs dependencies
- Runs both Node.js and Cloudflare builds sequentially

**Node.js Build: `scripts/dynamic-build-node.ts`**
- Copies upstream Node.js adapter source
- Applies all WebSocket modifications as code transformations
- Creates WebSocket files: `websocket/`, `middleware/`
- Adds `ws` dependency and WebSocket exports (`./websocket`, `./stats`)
- Resolves workspace dependencies to actual versions
- Builds in upstream workspace, then copies to final package

**Cloudflare Build: `scripts/dynamic-build-cloudflare.ts`**
- Copies upstream Cloudflare adapter source  
- Applies WebSocket modifications for Cloudflare Workers
- Creates WebSocket files and entrypoint modifications
- Adds WebSocket export to package.json
- Resolves workspace dependencies to actual versions
- Builds in upstream workspace, then copies to final package

#### 4. Available Scripts

```bash
# Full build process (recommended)
pnpm run build

# Test the Node.js adapter
pnpm run test:node

# Test the Cloudflare adapter  
pnpm run test:cloudflare

# Test both adapters
pnpm run test

# Reset the astro-upstream submodule to latest Astro tag
pnpm run reset

# Publish packages to npm (CI only)
pnpm run publish:packages
```

#### 5. Automated CI/CD Pipeline

The project uses **GitHub Actions** for automated building and publishing:

**Workflow: `.github/workflows/auto-publish.yml`**
- **Triggers**: Push to main, daily at 2 AM UTC, or manual dispatch
- **Process**:
  1. Checks out latest Astro tag from submodule
  2. Installs dependencies with workspace filtering
  3. Builds both adapters with dynamic build system
  4. Tests both adapters
  5. Updates package versions to `{adapter-version}-{commit-hash}`
  6. Publishes to npm with automation tokens
  7. Commits built packages to repo
  8. Creates GitHub release with version tag

**Version Strategy**:
- Uses **adapter-specific versions** (not Astro core version)
- Format: `8.3.4-abc1234` (Node adapter v8.3.4 + commit abc1234)
- Allows patch releases for fixes without waiting for Astro updates

#### 6. Key Features of Build System

**Workspace Dependency Resolution**:
- Automatically converts `@astrojs/internal-helpers@workspace:*` to actual versions
- Maps packages to correct workspace locations
- Handles complex monorepo dependency resolution

**README.md Distribution**:
- Automatically copies root README.md to each package
- Ensures npm packages have proper documentation

**Authentication & Publishing**:
- Uses npm automation tokens for 2FA bypass
- Creates `.npmrc` files in package directories
- Publishes to npm with proper access controls

#### 7. Development Workflow

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
   - Check workspace dependency resolution

4. **Update Tests**
   - Test projects are in `tests/projects/`
   - Update test projects to match API changes

#### 8. Key Differences from Patch-Based Approach

| Aspect | Old Patch System | New Dynamic System |
|--------|------------------|-------------------|
| **Modification Method** | Git patches | Code transformations |
| **Build Location** | Upstream directory | Upstream → Local packages |
| **Dependency Management** | Workspace conflicts | Automated workspace resolution |
| **TypeScript Compilation** | Upstream tsconfig | Upstream build → Copy dist |
| **Maintenance** | Manual patch updates | Automated code generation |
| **Debugging** | Patch application errors | Clear TypeScript errors |
| **CI/CD** | Manual publishing | Automated GitHub Actions |

#### 9. Adding New Features

To add new WebSocket features:

1. **Update the build scripts** to include your new files/modifications
2. **Add the files to the appropriate `createWebSocketFiles()` function**
3. **Update package.json exports** if needed in `updateUpstreamPackageJson()`
4. **Test the build process** with `pnpm run build`
5. **Update the test projects** to demonstrate the new features

#### 10. Troubleshooting Development Issues

**Build Fails with Workspace Dependency Errors:**
- Check that workspace dependency mapping is correct
- Verify that upstream packages exist at expected paths
- Ensure `--no-frozen-lockfile` is used in CI

**Missing WebSocket Files:**
- Check that `createWebSocketFiles()` creates all necessary files
- Verify file paths and exports are correct
- Ensure TypeScript compilation includes all source files

**Publishing Fails with ENEEDAUTH:**
- Verify npm automation token is stored as repository secret
- Check that `.npmrc` files are created in package directories
- Ensure registry-url is set correctly in GitHub Actions

**Version Mismatch Issues:**
- Verify that adapter versions are read from correct package.json paths
- Check that version update logic handles different adapter versions
- Ensure commit hash is properly extracted

This dynamic build system eliminates the need for manual patch management while providing automated CI/CD and reliable publishing to npm.

## License

MIT - see LICENSE file for details.

## Credits

This package is inspired by:
- [gratelets](https://github.com/gratelets/gratelets) - For the pre-patched adapter approach
- [astro-node-websocket](https://github.com/lilnasy/gratelets/tree/main/packages/node-websocket) - Original WebSocket integration concept
- The Astro team for the excellent framework and adapter architecture

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.