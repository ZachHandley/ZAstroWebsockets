# Enhanced Middleware for Astro WebSocket Applications

This middleware package provides automatic WebSocket tracking and integration with Astro applications, making WebSocket statistics and management available through `Astro.locals.websocketStats`.

## Features

- **Automatic Integration**: Seamlessly integrates with existing Astro middleware
- **Comprehensive Stats**: Provides real-time connection counts, health status, and detailed metrics
- **Page-level Tracking**: Tracks WebSocket connections per page/route
- **Privacy-focused**: Configurable privacy settings for production environments
- **Type-safe**: Full TypeScript support with proper type definitions
- **Development & Production Ready**: Different configurations for different environments
- **Connection Management**: Advanced connection pooling and health monitoring

## Quick Start

### Basic Setup

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware()
);
```

### Using in Components

**File: `src/pages/stats.astro`**

```astro
---
const connectionCount = Astro.locals.websocketStats?.getConnectionCount() || 0;
const stats = Astro.locals.websocketStats?.getConnectionStats();
---

<div>
  <h1>WebSocket Dashboard</h1>
  <p>Active Connections: {connectionCount}</p>
  
  {stats && (
    <div>
      <p>Total Ever: {stats.totalConnectionsEver}</p>
      <p>Average Age: {Math.round(stats.averageAge / 1000)}s</p>
    </div>
  )}
</div>
```

## Configuration Options

### Environment-specific Middleware

```typescript
import { 
  createBasicStatsMiddleware,
  createDevStatsMiddleware 
} from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  process.env.NODE_ENV === 'development' 
    ? createDevStatsMiddleware()    // Full features for development
    : createBasicStatsMiddleware()  // Privacy-focused for production
);
```

### Custom Configuration

```typescript
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware({
    includeDetailedStats: true,
    includeManagerStats: true,
    trackPageConnections: true,
    enableLogging: false,
    includeIPAddresses: false,  // Privacy-focused
    includeUserAgents: false,   // Privacy-focused
    connectionFilter: (connection) => {
      // Only include healthy connections
      return connection.healthStatus === 'healthy';
    }
  })
);
```

### Advanced Connection Management

```typescript
import { createAdvancedStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createAdvancedStatsMiddleware(
    {
      includeDetailedStats: true,
      trackPageConnections: true
    },
    {
      maxConnections: 1000,
      maxConnectionsPerIP: 10,
      enableRateLimit: true,
      enableHealthMonitoring: true,
      idleTimeout: 300000, // 5 minutes
    }
  )
);
```

## API Reference

### `Astro.locals.websocketStats`

The middleware adds a `websocketStats` object to `Astro.locals` with the following methods:

#### `getConnectionCount(): number`
Returns the total number of active WebSocket connections.

#### `getConnectionStats(): ConnectionStats`
Returns detailed statistics about all connections including:
- Total connections ever established
- Average connection age and idle time
- Connections grouped by state (OPEN, CONNECTING, etc.)
- Individual connection details (filtered based on privacy settings)

#### `getManagerStats(): ManagerStats` (if enabled)
Returns advanced connection manager statistics including:
- Connection pooling information
- Rate limiting status
- Health monitoring results
- Per-IP connection counts

#### `getPageConnections(): ManagedConnection[]` (if page tracking enabled)
Returns connections associated with the current page/route.

#### `getFilteredConnections(): any[]`
Returns connections filtered by the configured `connectionFilter` function.

#### `isWebSocketEnabled(): boolean`
Returns whether the WebSocket system is currently enabled and operational.

#### `getConnectionsByStatus(): Record<string, number>`
Returns connection counts grouped by their current status.

## Middleware Functions

### `createStatsMiddleware(config?)`
Creates a fully customizable middleware with all configuration options.

### `createBasicStatsMiddleware()`
Creates a privacy-focused middleware suitable for production:
- No detailed connection info
- No IP addresses or user agents
- No connection IDs
- Minimal logging

### `createDevStatsMiddleware()`
Creates a development-focused middleware with all features enabled:
- Full connection details
- IP addresses and user agents
- Connection IDs
- Automatic logging every 15 seconds

### `createAdvancedStatsMiddleware(config?, managerConfig?)`
Creates middleware with advanced connection management features:
- Connection pooling and limits
- Rate limiting per IP
- Health monitoring
- Background cleanup services

## Configuration Options

### `StatsMiddlewareConfig`

```typescript
interface StatsMiddlewareConfig {
  includeDetailedStats?: boolean;        // Include full connection details
  includeManagerStats?: boolean;         // Include connection manager stats
  includeConnectionCount?: boolean;      // Include basic connection count
  includeConnectionIds?: boolean;        // Include connection IDs (privacy)
  includeIPAddresses?: boolean;          // Include IP addresses (privacy)
  includeUserAgents?: boolean;           // Include user agents (privacy)
  connectionFilter?: (connection) => boolean; // Custom connection filter
  enableLogging?: boolean;               // Enable automatic logging
  logInterval?: number;                  // Log interval in milliseconds
  trackPageConnections?: boolean;        // Track connections per page
  includeHelperFunctions?: boolean;      // Include helper functions
}
```

### `ConnectionManagerConfig`

```typescript
interface ConnectionManagerConfig {
  maxConnections?: number;               // Global connection limit
  maxConnectionsPerIP?: number;          // Per-IP connection limit
  idleTimeout?: number;                  // Idle timeout in milliseconds
  enableRateLimit?: boolean;             // Enable rate limiting
  enableHealthMonitoring?: boolean;      // Enable health checks
  rateLimitWindow?: number;              // Rate limit window
  rateLimitMaxConnections?: number;      // Max connections in window
  healthCheckInterval?: number;          // Health check interval
  cleanupInterval?: number;              // Cleanup interval
}
```

## Type Safety

The middleware provides full TypeScript support with proper type definitions:

```typescript
import type { 
  WebSocketStatsLocals,
  StatsMiddlewareConfig,
  WithWebSocketStats,
  APIContextWithWebSocketStats
} from 'zastro-websockets-node/middleware';

// Type-safe component usage
const { locals } = Astro as WithWebSocketStats<typeof Astro>;
const stats = locals.websocketStats.getConnectionStats();

// Type guard for checking availability
import { hasWebSocketStats } from 'zastro-websockets-node/middleware';

if (hasWebSocketStats(Astro.locals)) {
  // TypeScript knows websocketStats is available here
  const count = Astro.locals.websocketStats.getConnectionCount();
}
```

## Best Practices

### Production Configuration
- Use `createBasicStatsMiddleware()` for privacy
- Disable detailed stats and personal information
- Set appropriate connection limits
- Enable rate limiting

### Development Configuration
- Use `createDevStatsMiddleware()` for full features
- Enable logging for debugging
- Include detailed connection information
- Track page-specific connections

### Security Considerations
- Never include IP addresses or user agents in client-side code
- Use connection filters to limit exposed information
- Set appropriate connection limits to prevent abuse
- Enable rate limiting in production

### Performance Tips
- Disable page tracking if not needed
- Use connection filters to reduce data processing
- Set appropriate cleanup intervals
- Monitor connection counts and limits

## Integration Examples

See the [complete integration examples](./examples.ts) for detailed usage patterns including:

- Dashboard components
- Real-time stats WebSockets
- API endpoints
- Environment-specific configurations
- Type-safe implementations

## Automatic Features

The middleware automatically:

1. **Tracks all WebSocket connections** established through the adapter
2. **Associates connections with pages** that initiated them (if enabled)
3. **Provides real-time statistics** without manual setup
4. **Handles cleanup** when connections close
5. **Respects privacy settings** for production environments
6. **Integrates with existing middleware** through Astro's sequence() function

This provides a complete, production-ready solution for WebSocket monitoring and management in Astro applications.