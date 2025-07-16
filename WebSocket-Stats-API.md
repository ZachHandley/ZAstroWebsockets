# WebSocket Stats API Documentation

The WebSocket Stats API provides comprehensive connection tracking, statistics, and administrative functions for managing WebSocket connections in Node.js environments using `zastro-websockets-node`.

## Features

- **Real-time Connection Tracking**: Automatically tracks all WebSocket connections with metadata
- **Statistics Collection**: Provides detailed stats about connections, usage patterns, and performance
- **Administrative Functions**: Close connections, cleanup stale connections, graceful shutdown
- **Connection Metadata**: Track IP addresses, user agents, connection age, and idle time
- **Automatic Cleanup**: Removes stale connections and handles graceful shutdowns
- **Development & Production Ready**: Works seamlessly in both environments

## Quick Start

### Installation

The WebSocket Stats API is included with `zastro-websockets-node`:

```bash
npm install zastro-websockets-node
```

### Basic Usage

```typescript
import { WebSocketStats } from 'zastro-websockets-node'

// Get connection count
const count = WebSocketStats.getConnectionCount()

// Get detailed statistics
const stats = WebSocketStats.getConnectionStats()

// Get active WebSocket instances
const activeConnections = WebSocketStats.getActiveConnections()

// Close all connections
WebSocketStats.closeAllConnections()
```

## API Reference

### WebSocketStats.getConnectionCount()

Returns the total number of active WebSocket connections.

```typescript
const activeCount: number = WebSocketStats.getConnectionCount()
console.log(`Active connections: ${activeCount}`)
```

### WebSocketStats.getConnectionStats()

Returns detailed statistics about all connections.

```typescript
interface ConnectionStats {
  totalConnections: number           // Current active connections
  totalConnectionsEver: number       // Total connections since startup
  totalConnectionsClosed: number     // Total connections that have closed
  averageAge: number                 // Average connection age in milliseconds
  averageIdleTime: number           // Average idle time in milliseconds
  connectionsByState: {
    CONNECTING: number
    OPEN: number
    CLOSING: number
    CLOSED: number
  }
  connections: Array<{
    id: string
    age: number                      // Connection age in milliseconds
    idleTime: number                // Idle time in milliseconds
    state: string                   // Connection state
    remoteAddress?: string          // Client IP address
    userAgent?: string             // Client user agent
  }>
}

const stats = WebSocketStats.getConnectionStats()
console.log(`Active: ${stats.totalConnections}, Total: ${stats.totalConnectionsEver}`)
```

### WebSocketStats.getActiveConnections()

Returns a Set of active WebSocket instances.

```typescript
const activeConnections: Set<WebSocket> = WebSocketStats.getActiveConnections()

// Broadcast to all active connections
for (const socket of activeConnections) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send('Broadcast message')
  }
}
```

### WebSocketStats.closeAllConnections(code?, reason?)

Closes all active WebSocket connections.

```typescript
// Close all with default code
WebSocketStats.closeAllConnections()

// Close all with custom code and reason
WebSocketStats.closeAllConnections(1000, 'Server maintenance')
```

**Parameters:**
- `code` (optional): WebSocket close code (default: 1000)
- `reason` (optional): Close reason string

### WebSocketStats.cleanupStaleConnections()

Manually clean up connections that are already closed but not yet cleaned up from tracking.

```typescript
const cleanedCount: number = WebSocketStats.cleanupStaleConnections()
console.log(`Cleaned up ${cleanedCount} stale connections`)
```

### WebSocketStats.shutdown()

Gracefully shutdown the connection manager, closing all connections and cleaning up resources.

```typescript
// Graceful shutdown
WebSocketStats.shutdown()
```

**Note:** This is automatically called on process SIGINT and SIGTERM signals.

### WebSocketStats.isShutDown

Read-only property indicating if the stats manager has been shut down.

```typescript
if (WebSocketStats.isShutDown) {
  console.log('Stats manager is shut down')
}
```

## Integration Examples

### Astro API Route with Stats

```typescript
// src/pages/api/websocket.ts
import type { APIRoute } from 'astro'
import { WebSocketStats } from 'zastro-websockets-node'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { response, socket } = ctx.locals.upgradeWebSocket()
    
    socket.onopen = () => {
      console.log(`WebSocket connected. Total: ${WebSocketStats.getConnectionCount()}`)
      
      // Send welcome message with stats
      const stats = WebSocketStats.getConnectionStats()
      socket.send(JSON.stringify({
        type: 'welcome',
        totalConnections: stats.totalConnections
      }))
    }
    
    socket.onclose = () => {
      console.log(`WebSocket closed. Remaining: ${WebSocketStats.getConnectionCount()}`)
    }
    
    return response
  }
  
  return new Response('Upgrade required', { status: 426 })
}
```

### Admin Dashboard

```typescript
// src/pages/api/admin.ts
import type { APIRoute } from 'astro'
import { WebSocketStats } from 'zastro-websockets-node'

export const POST: APIRoute = async ({ request }) => {
  const { action } = await request.json()
  
  switch (action) {
    case 'get_stats':
      return new Response(JSON.stringify(WebSocketStats.getConnectionStats()))
      
    case 'close_all':
      WebSocketStats.closeAllConnections()
      return new Response(JSON.stringify({ success: true }))
      
    case 'cleanup':
      const cleaned = WebSocketStats.cleanupStaleConnections()
      return new Response(JSON.stringify({ cleaned }))
  }
}
```

### Middleware Integration

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config'
import node from 'zastro-websockets-node'
import { createStatsMiddleware } from 'zastro-websockets-node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    createStatsMiddleware() // Automatically logs stats every 30 seconds
  ]
})
```

### Periodic Stats Logging

```typescript
import { logConnectionStats } from 'zastro-websockets-node'

// Log stats every 30 seconds
setInterval(() => {
  logConnectionStats()
}, 30000)

// Output:
// [WebSocket Stats] Active: 5, Total: 23, Closed: 18
// [WebSocket Stats] Avg Age: 45s, Avg Idle: 12s
// [WebSocket Stats] By State - Open: 5, Connecting: 0, Closing: 0
```

### Graceful Shutdown

```typescript
// src/utils/graceful-shutdown.ts
import { WebSocketStats } from 'zastro-websockets-node'

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`)
    
    // Close all WebSocket connections
    WebSocketStats.closeAllConnections(1001, 'Server shutting down')
    
    // Wait for connections to close
    setTimeout(() => {
      WebSocketStats.shutdown()
      process.exit(0)
    }, 1000)
  }
  
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

setupGracefulShutdown()
```

## Connection Metadata

The stats system automatically tracks metadata for each connection:

- **Connection ID**: Unique identifier for each connection
- **Timestamps**: Connection time and last activity time
- **Remote Address**: Client IP address (extracted from request headers)
- **User Agent**: Client user agent string
- **Connection State**: Current WebSocket state (CONNECTING, OPEN, CLOSING, CLOSED)
- **Age**: Time since connection was established
- **Idle Time**: Time since last activity (message sent/received)

## Automatic Features

### Connection Lifecycle Tracking

The stats system automatically:
- Registers new connections when they're established
- Updates activity timestamps on message events
- Removes connections when they close
- Tracks connection state changes

### Cleanup and Memory Management

- **Automatic Cleanup**: Stale connections are cleaned up every 30 seconds
- **Memory Efficient**: Uses WeakMaps to prevent memory leaks
- **Graceful Shutdown**: Handles process signals for clean shutdown

### Error Handling

- Gracefully handles registration failures
- Continues operation even if stats tracking fails
- Provides console warnings for debugging

## Production Considerations

### Performance

- **Minimal Overhead**: Stats tracking adds negligible performance impact
- **Efficient Storage**: Uses WeakMaps and efficient data structures
- **Automatic Cleanup**: Prevents memory accumulation over time

### Monitoring

Use the stats API for production monitoring:

```typescript
// Health check endpoint
export const GET: APIRoute = () => {
  const stats = WebSocketStats.getConnectionStats()
  
  return new Response(JSON.stringify({
    status: 'healthy',
    activeConnections: stats.totalConnections,
    averageAge: Math.round(stats.averageAge / 1000),
    uptime: process.uptime()
  }))
}
```

### Load Balancing

For load-balanced deployments, each instance tracks its own connections:

```typescript
// Instance-specific stats
const stats = WebSocketStats.getConnectionStats()
const instanceInfo = {
  instanceId: process.env.INSTANCE_ID,
  connections: stats.totalConnections,
  totalEver: stats.totalConnectionsEver
}
```

## Troubleshooting

### Common Issues

1. **Stats not updating**: Ensure connections are being created through the official adapter
2. **Memory growth**: Check if cleanup is running with `cleanupStaleConnections()`
3. **Missing metadata**: IP/User-Agent require proper request object passing

### Debug Logging

Enable debug logging:

```typescript
import { logConnectionStats } from 'zastro-websockets-node'

// Log stats immediately
logConnectionStats()

// Set up periodic logging
setInterval(logConnectionStats, 10000) // Every 10 seconds
```

### Monitoring Stale Connections

```typescript
const stats = WebSocketStats.getConnectionStats()
const staleConnections = stats.connections.filter(conn => 
  conn.idleTime > 5 * 60 * 1000 // 5 minutes idle
)

if (staleConnections.length > 0) {
  console.warn(`Found ${staleConnections.length} stale connections`)
}
```

## Version Compatibility

The WebSocket Stats API is available in:
- `zastro-websockets-node` v1.0.0+
- Compatible with Astro v4.0.0+ and v5.0.0+
- Node.js 18.0.0+

## License

This API is part of the `zastro-websockets-node` package and follows the same MIT license.