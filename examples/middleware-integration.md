# Enhanced Middleware Integration Examples

This document provides comprehensive examples of how to use the enhanced middleware with Astro applications for automatic WebSocket tracking and integration.

## Installation

```bash
npm install zastro-websockets-node
```

## Basic Setup

### 1. Simple Middleware Integration

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware()
);
```

### 2. Development vs Production Configuration

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { 
  createDevStatsMiddleware, 
  createBasicStatsMiddleware 
} from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  process.env.NODE_ENV === 'development' 
    ? createDevStatsMiddleware()
    : createBasicStatsMiddleware()
);
```

### 3. Custom Configuration

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware({
    includeDetailedStats: true,
    includeManagerStats: true,
    trackPageConnections: true,
    enableLogging: process.env.NODE_ENV === 'development',
    logInterval: 30000,
    includeIPAddresses: false, // Privacy-focused
    includeUserAgents: false,  // Privacy-focused
    connectionFilter: (connection) => {
      // Only include healthy, high-priority connections
      return connection.healthStatus === 'healthy' && connection.priority >= 5;
    }
  })
);
```

## Advanced Configuration

### 4. Connection Manager Integration

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { createAdvancedStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createAdvancedStatsMiddleware(
    {
      includeDetailedStats: true,
      trackPageConnections: true,
      enableLogging: true
    },
    {
      maxConnections: 1000,
      maxConnectionsPerIP: 10,
      enableRateLimit: true,
      enableHealthMonitoring: true,
      idleTimeout: 300000, // 5 minutes
      rateLimitWindow: 60000, // 1 minute
      rateLimitMaxConnections: 5
    }
  )
);
```

## Using WebSocket Stats in Components

### 5. Stats Dashboard Component

**File: `src/pages/admin/websocket-dashboard.astro`**

```astro
---
import { hasWebSocketStats } from 'zastro-websockets-node/middleware';

// Type-safe access to WebSocket stats
const stats = hasWebSocketStats(Astro.locals) 
  ? Astro.locals.websocketStats.getConnectionStats()
  : null;

const connectionCount = Astro.locals.websocketStats?.getConnectionCount() || 0;
const managerStats = Astro.locals.websocketStats?.getManagerStats?.();
const pageConnections = Astro.locals.websocketStats?.getPageConnections?.() || [];
const isEnabled = Astro.locals.websocketStats?.isWebSocketEnabled() || false;
---

<html>
<head>
  <title>WebSocket Dashboard</title>
  <style>
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .stat-card {
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #007bff;
      margin: 0.5rem 0;
    }
    .stat-label {
      color: #6c757d;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-enabled {
      background-color: #28a745;
    }
    .status-disabled {
      background-color: #dc3545;
    }
    .connections-table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
    }
    .connections-table th,
    .connections-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    .connections-table th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .health-healthy { color: #28a745; }
    .health-unhealthy { color: #dc3545; }
    .health-unknown { color: #6c757d; }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>WebSocket Dashboard</h1>
    
    <div class="status">
      <span class={`status-indicator ${isEnabled ? 'status-enabled' : 'status-disabled'}`}></span>
      WebSocket System: {isEnabled ? 'Enabled' : 'Disabled'}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Active Connections</div>
        <div class="stat-number">{connectionCount}</div>
      </div>
      
      {stats && (
        <>
          <div class="stat-card">
            <div class="stat-label">Total Ever</div>
            <div class="stat-number">{stats.totalConnectionsEver}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Average Age</div>
            <div class="stat-number">{Math.round(stats.averageAge / 1000)}s</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Average Idle</div>
            <div class="stat-number">{Math.round(stats.averageIdleTime / 1000)}s</div>
          </div>
        </>
      )}
      
      {managerStats && (
        <>
          <div class="stat-card">
            <div class="stat-label">Managed Connections</div>
            <div class="stat-number">{managerStats.totalManagedConnections}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Unique IPs</div>
            <div class="stat-number">{managerStats.connectionsByIP}</div>
          </div>
        </>
      )}
      
      <div class="stat-card">
        <div class="stat-label">Page Connections</div>
        <div class="stat-number">{pageConnections.length}</div>
      </div>
    </div>

    {stats && (
      <div class="section">
        <h2>Connections by State</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Open</div>
            <div class="stat-number">{stats.connectionsByState.OPEN}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Connecting</div>
            <div class="stat-number">{stats.connectionsByState.CONNECTING}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Closing</div>
            <div class="stat-number">{stats.connectionsByState.CLOSING}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Closed</div>
            <div class="stat-number">{stats.connectionsByState.CLOSED}</div>
          </div>
        </div>
      </div>
    )}

    {pageConnections.length > 0 && (
      <div class="section">
        <h2>Page Connections</h2>
        <table class="connections-table">
          <thead>
            <tr>
              <th>Connection</th>
              <th>Age</th>
              <th>Idle Time</th>
              <th>Health</th>
              <th>Priority</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {pageConnections.map(conn => (
              <tr>
                <td>{conn.id.substring(0, 8)}...</td>
                <td>{Math.round(conn.age / 1000)}s</td>
                <td>{Math.round(conn.idleTime / 1000)}s</td>
                <td class={`health-${conn.healthStatus}`}>
                  {conn.healthStatus}
                </td>
                <td>{conn.priority}</td>
                <td>{Array.from(conn.tags).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
</body>
</html>
```

### 6. API Endpoint for Stats

**File: `src/pages/api/websocket-stats.ts`**

```typescript
import type { APIRoute } from 'astro';
import { hasWebSocketStats } from 'zastro-websockets-node/middleware';

export const GET: APIRoute = ({ locals, url }) => {
  // Check if WebSocket stats are available
  if (!hasWebSocketStats(locals)) {
    return new Response(JSON.stringify({ 
      error: 'WebSocket stats not available',
      available: false 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const includeDetails = url.searchParams.get('details') === 'true';
  const includeManager = url.searchParams.get('manager') === 'true';
  
  const response = {
    available: true,
    enabled: locals.websocketStats.isWebSocketEnabled(),
    connectionCount: locals.websocketStats.getConnectionCount(),
    connectionsByStatus: locals.websocketStats.getConnectionsByStatus(),
    timestamp: new Date().toISOString()
  };
  
  if (includeDetails) {
    response.detailedStats = locals.websocketStats.getConnectionStats();
    response.filteredConnections = locals.websocketStats.getFilteredConnections();
    response.pageConnections = locals.websocketStats.getPageConnections?.() || [];
  }
  
  if (includeManager && locals.websocketStats.getManagerStats) {
    response.managerStats = locals.websocketStats.getManagerStats();
  }
  
  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### 7. Real-time Stats WebSocket

**File: `src/pages/api/live-stats.ts`**

```typescript
import type { APIRoute } from 'astro';
import { hasWebSocketStats } from 'zastro-websockets-node/middleware';

export const GET: APIRoute = (ctx) => {
  if (!ctx.locals.isUpgradeRequest) {
    return new Response('WebSocket upgrade required', { status: 426 });
  }

  const { response, socket } = ctx.locals.upgradeWebSocket();
  
  socket.onopen = () => {
    console.log('Live stats WebSocket connected');
    
    // Send initial stats if available
    if (hasWebSocketStats(ctx.locals)) {
      const initialStats = {
        type: 'initial',
        data: {
          connectionCount: ctx.locals.websocketStats.getConnectionCount(),
          isEnabled: ctx.locals.websocketStats.isWebSocketEnabled(),
          connectionsByStatus: ctx.locals.websocketStats.getConnectionsByStatus(),
          timestamp: new Date().toISOString()
        }
      };
      socket.send(JSON.stringify(initialStats));
    }
    
    // Send periodic updates
    const interval = setInterval(() => {
      if (socket.readyState === socket.OPEN && hasWebSocketStats(ctx.locals)) {
        const update = {
          type: 'update',
          data: {
            connectionCount: ctx.locals.websocketStats.getConnectionCount(),
            connectionsByStatus: ctx.locals.websocketStats.getConnectionsByStatus(),
            timestamp: new Date().toISOString()
          }
        };
        socket.send(JSON.stringify(update));
      } else if (socket.readyState !== socket.OPEN) {
        clearInterval(interval);
      }
    }, 5000); // Update every 5 seconds
    
    socket.onclose = () => {
      clearInterval(interval);
      console.log('Live stats WebSocket disconnected');
    };
  };
  
  socket.onmessage = (event) => {
    if (!hasWebSocketStats(ctx.locals)) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'WebSocket stats not available' 
      }));
      return;
    }

    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'getStats':
          const stats = ctx.locals.websocketStats.getConnectionStats();
          socket.send(JSON.stringify({ 
            type: 'stats', 
            data: stats 
          }));
          break;
          
        case 'getManagerStats':
          if (ctx.locals.websocketStats.getManagerStats) {
            const managerStats = ctx.locals.websocketStats.getManagerStats();
            socket.send(JSON.stringify({ 
              type: 'managerStats', 
              data: managerStats 
            }));
          } else {
            socket.send(JSON.stringify({ 
              type: 'error', 
              message: 'Manager stats not available' 
            }));
          }
          break;
          
        default:
          socket.send(JSON.stringify({ 
            type: 'error', 
            message: 'Unknown message type' 
          }));
      }
    } catch (error) {
      socket.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  };
  
  socket.onerror = (error) => {
    console.error('Live stats WebSocket error:', error);
  };
  
  return response;
};
```

### 8. Environment-Specific Configuration

**File: `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import node from 'zastro-websockets-node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    // Add any other integrations here
  ]
});
```

**File: `src/middleware.ts`**

```typescript
import { sequence } from 'astro:middleware';
import { 
  createStatsMiddleware,
  createDevStatsMiddleware,
  createBasicStatsMiddleware 
} from 'zastro-websockets-node/middleware';

// Environment-specific configuration
const createMiddleware = () => {
  const env = process.env.NODE_ENV;
  
  if (env === 'development') {
    return createDevStatsMiddleware();
  }
  
  if (env === 'production') {
    return createBasicStatsMiddleware();
  }
  
  // Staging or other environments
  return createStatsMiddleware({
    includeDetailedStats: true,
    includeManagerStats: true,
    trackPageConnections: true,
    enableLogging: true,
    includeIPAddresses: false,
    includeUserAgents: false
  });
};

export const onRequest = sequence(createMiddleware());
```

## TypeScript Integration

### 9. Type-Safe Component Usage

**File: `src/components/WebSocketStatus.astro`**

```astro
---
import type { WithWebSocketStats } from 'zastro-websockets-node/middleware';

// Type assertion for better type safety
const { locals } = Astro as WithWebSocketStats<typeof Astro>;

const connectionCount = locals.websocketStats.getConnectionCount();
const isEnabled = locals.websocketStats.isWebSocketEnabled();
---

<div class="websocket-status">
  <span class={`indicator ${isEnabled ? 'enabled' : 'disabled'}`}></span>
  WebSocket: {isEnabled ? 'Active' : 'Inactive'} 
  ({connectionCount} connections)
</div>

<style>
  .websocket-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
    font-size: 14px;
  }
  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .indicator.enabled {
    background: #28a745;
  }
  .indicator.disabled {
    background: #dc3545;
  }
</style>
```

This comprehensive integration provides:

1. **Automatic tracking** of WebSocket connections with page association
2. **Flexible configuration** for different environments
3. **Type-safe access** to WebSocket stats in components
4. **Real-time monitoring** capabilities
5. **Privacy-focused options** for production environments
6. **Advanced connection management** with health monitoring and rate limiting
7. **Easy integration** with existing Astro middleware patterns

The middleware automatically provides `Astro.locals.websocketStats` with comprehensive connection information while respecting privacy and performance considerations.