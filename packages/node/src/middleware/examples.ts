/**
 * Examples demonstrating how to use the enhanced middleware 
 * in Astro applications for WebSocket integration
 */

import { 
  createStatsMiddleware, 
  createAdvancedStatsMiddleware,
  createBasicStatsMiddleware,
  createDevStatsMiddleware,
  type StatsMiddlewareConfig 
} from './index.js';

// Example 1: Basic middleware for production
// File: src/middleware.ts
/*
import { sequence } from 'astro:middleware';
import { createBasicStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createBasicStatsMiddleware()
);
*/

// Example 2: Development middleware with full features
// File: src/middleware.ts (development)
/*
import { sequence } from 'astro:middleware';
import { createDevStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createDevStatsMiddleware()
);
*/

// Example 3: Custom middleware configuration
// File: src/middleware.ts
/*
import { sequence } from 'astro:middleware';
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware({
    includeDetailedStats: true,
    includeManagerStats: true,
    trackPageConnections: true,
    enableLogging: true,
    logInterval: 30000,
    connectionFilter: (connection) => {
      // Only include healthy connections
      return connection.healthStatus === 'healthy';
    }
  })
);
*/

// Example 4: Advanced middleware with connection manager
// File: src/middleware.ts
/*
import { sequence } from 'astro:middleware';
import { createAdvancedStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createAdvancedStatsMiddleware(
    {
      includeDetailedStats: true,
      trackPageConnections: true
    },
    {
      maxConnections: 500,
      maxConnectionsPerIP: 5,
      enableRateLimit: true,
      enableHealthMonitoring: true
    }
  )
);
*/

// Example 5: Using WebSocket stats in Astro pages
// File: src/pages/admin/websocket-stats.astro
/*
---
// This would be used in an Astro component
const stats = Astro.locals.websocketStats?.getConnectionStats();
const managerStats = Astro.locals.websocketStats?.getManagerStats?.();
const connectionCount = Astro.locals.websocketStats?.getConnectionCount() || 0;
const pageConnections = Astro.locals.websocketStats?.getPageConnections?.() || [];
---

<html>
<head>
  <title>WebSocket Stats Dashboard</title>
</head>
<body>
  <h1>WebSocket Connection Dashboard</h1>
  
  <div class="stats-grid">
    <div class="stat-card">
      <h2>Active Connections</h2>
      <p class="stat-number">{connectionCount}</p>
    </div>
    
    {stats && (
      <div class="stat-card">
        <h2>Total Connections Ever</h2>
        <p class="stat-number">{stats.totalConnectionsEver}</p>
      </div>
    )}
    
    {stats && (
      <div class="stat-card">
        <h2>Average Age</h2>
        <p class="stat-number">{Math.round(stats.averageAge / 1000)}s</p>
      </div>
    )}
    
    {managerStats && (
      <div class="stat-card">
        <h2>Managed Connections</h2>
        <p class="stat-number">{managerStats.totalManagedConnections}</p>
      </div>
    )}
  </div>
  
  <div class="connections-by-state">
    <h2>Connections by State</h2>
    {stats && (
      <ul>
        <li>Open: {stats.connectionsByState.OPEN}</li>
        <li>Connecting: {stats.connectionsByState.CONNECTING}</li>
        <li>Closing: {stats.connectionsByState.CLOSING}</li>
        <li>Closed: {stats.connectionsByState.CLOSED}</li>
      </ul>
    )}
  </div>
  
  {pageConnections.length > 0 && (
    <div class="page-connections">
      <h2>Connections for This Page</h2>
      <p>This page has {pageConnections.length} active connections</p>
    </div>
  )}

  <style>
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .stat-card {
      padding: 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      color: #007bff;
    }
    
    .connections-by-state ul {
      list-style: none;
      padding: 0;
    }
    
    .connections-by-state li {
      padding: 0.5rem 0;
      border-bottom: 1px solid #eee;
    }
  </style>
</body>
</html>
*/

// Example 6: API endpoint using WebSocket stats
// File: src/pages/api/websocket-stats.ts
/*
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ locals, url }) => {
  const includeDetails = url.searchParams.get('details') === 'true';
  
  if (!locals.websocketStats) {
    return new Response(JSON.stringify({ error: 'WebSocket stats not available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const stats = {
    connectionCount: locals.websocketStats.getConnectionCount(),
    isWebSocketEnabled: locals.websocketStats.isWebSocketEnabled(),
    connectionsByStatus: locals.websocketStats.getConnectionsByStatus(),
  };
  
  if (includeDetails) {
    stats.detailedStats = locals.websocketStats.getConnectionStats();
    stats.managerStats = locals.websocketStats.getManagerStats?.();
    stats.filteredConnections = locals.websocketStats.getFilteredConnections();
  }
  
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' }
  });
};
*/

// Example 7: Real-time stats component with WebSocket
// File: src/pages/api/websocket-live-stats.ts
/*
import type { APIRoute } from 'astro';

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { response, socket } = ctx.locals.upgradeWebSocket();
    
    socket.onopen = () => {
      console.log('Live stats WebSocket connected');
      
      // Send initial stats
      const stats = ctx.locals.websocketStats?.getConnectionStats();
      socket.send(JSON.stringify({ type: 'initial', data: stats }));
      
      // Send periodic updates
      const interval = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          const currentStats = ctx.locals.websocketStats?.getConnectionStats();
          socket.send(JSON.stringify({ type: 'update', data: currentStats }));
        } else {
          clearInterval(interval);
        }
      }, 5000); // Update every 5 seconds
      
      socket.onclose = () => {
        clearInterval(interval);
      };
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'getStats') {
        const stats = ctx.locals.websocketStats?.getConnectionStats();
        socket.send(JSON.stringify({ type: 'response', data: stats }));
      }
    };
    
    return response;
  }
  
  return new Response('WebSocket upgrade required', { status: 426 });
};
*/

// Example 8: Custom middleware with route-specific tracking
// File: src/middleware.ts
/*
import { sequence } from 'astro:middleware';
import { createStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = sequence(
  createStatsMiddleware({
    trackPageConnections: true,
    connectionFilter: (connection) => {
      // Custom filtering based on connection metadata
      return connection.priority >= 5 && connection.healthStatus !== 'unhealthy';
    },
    includeDetailedStats: process.env.NODE_ENV === 'development',
    enableLogging: process.env.NODE_ENV === 'development'
  })
);
*/

// Example 9: Middleware for admin dashboard
// File: src/pages/admin/middleware.ts (if using route-specific middleware)
/*
import { createAdvancedStatsMiddleware } from 'zastro-websockets-node/middleware';

export const onRequest = createAdvancedStatsMiddleware(
  {
    includeDetailedStats: true,
    includeConnectionIds: true,
    includeIPAddresses: true,
    includeUserAgents: true,
    trackPageConnections: true,
    enableLogging: true
  },
  {
    enableHealthMonitoring: true,
    healthCheckInterval: 10000 // More frequent health checks for admin
  }
);
*/

export {}; // Make this a module