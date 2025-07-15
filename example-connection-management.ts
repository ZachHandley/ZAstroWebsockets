/**
 * Example of WebSocket connection management with ZAstroWebsockets
 * 
 * This example shows how to use the built-in connection tracking and cleanup features
 */

import { defineConfig } from 'astro/config';
import node from 'zastro-websockets/node';
import { WebSocketStats, logConnectionStats, createStatsMiddleware } from 'zastro-websockets/node';

// Basic Astro config with WebSocket support
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    // Add the stats middleware to track connections
    {
      name: 'websocket-stats',
      hooks: {
        'astro:server:setup': ({ server }) => {
          // Log stats every 30 seconds
          setInterval(() => {
            logConnectionStats();
          }, 30000);
        }
      }
    }
  ]
});

// Example Astro API route with WebSocket support
// File: src/pages/api/websocket.ts
/*
export const GET = async (context) => {
  const { socket, response } = context.locals.upgradeWebSocket();
  
  // Log connection stats when new connection is established
  socket.addEventListener('open', () => {
    console.log('WebSocket connected');
    console.log(`Total connections: ${WebSocketStats.getConnectionCount()}`);
  });
  
  // Handle messages
  socket.addEventListener('message', (event) => {
    console.log('Message received:', event.data);
    
    // Echo the message back
    socket.send(`Echo: ${event.data}`);
  });
  
  // Handle connection close
  socket.addEventListener('close', () => {
    console.log('WebSocket disconnected');
    console.log(`Remaining connections: ${WebSocketStats.getConnectionCount()}`);
  });
  
  return response;
};
*/

// Example middleware to add connection stats to all pages
// File: src/middleware/websocket-stats.ts
/*
import { WebSocketStats } from 'zastro-websockets/node';

export const onRequest = async (context, next) => {
  // Add WebSocket stats to all pages
  context.locals.websocketStats = {
    connectionCount: WebSocketStats.getConnectionCount(),
    getStats: () => WebSocketStats.getConnectionStats(),
    getActiveConnections: () => WebSocketStats.getActiveConnections(),
  };
  
  return next();
};
*/

// Example of displaying connection stats in a component
// File: src/components/ConnectionStats.astro
/*
---
const stats = Astro.locals.websocketStats?.getStats();
---

<div class="connection-stats">
  <h3>WebSocket Connection Stats</h3>
  <p>Active Connections: {stats?.totalConnections || 0}</p>
  {stats?.connections.map((conn, index) => (
    <div key={index} class="connection-info">
      <p>Connection {index + 1}:</p>
      <ul>
        <li>Age: {Math.round(conn.age / 1000)}s</li>
        <li>Idle: {Math.round(conn.idleTime / 1000)}s</li>
        <li>IP: {conn.remoteAddress || 'Unknown'}</li>
      </ul>
    </div>
  ))}
</div>
*/

// Example of programmatically managing connections
// File: src/pages/admin/connections.ts
/*
import { WebSocketStats } from 'zastro-websockets/node';

export const POST = async ({ request }) => {
  const action = await request.json();
  
  switch (action.type) {
    case 'GET_STATS':
      return new Response(JSON.stringify(WebSocketStats.getConnectionStats()), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case 'CLOSE_ALL':
      WebSocketStats.closeAllConnections();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};
*/

// Graceful shutdown example
// File: src/utils/graceful-shutdown.ts
/*
import { WebSocketStats } from 'zastro-websockets/node';

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    // Close all WebSocket connections
    WebSocketStats.closeAllConnections();
    
    // Shutdown the connection manager
    WebSocketStats.shutdown();
    
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Call this in your server setup
setupGracefulShutdown();
*/