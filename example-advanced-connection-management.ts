/**
 * Advanced Connection Management Example with ZAstroWebsockets
 * 
 * This example demonstrates the advanced ConnectionManager features including:
 * - Connection pooling and limits
 * - Rate limiting per IP
 * - Health monitoring
 * - Background cleanup services
 * - Custom connection management policies
 */

import { defineConfig } from 'astro/config';
import node from 'zastro-websockets-node';
import { 
  ConnectionManager, 
  ConnectionManagerAPI, 
  getConnectionManager,
  type ConnectionManagerConfig 
} from 'zastro-websockets-node/connection-manager';

// Advanced connection manager configuration
const connectionConfig: ConnectionManagerConfig = {
  // Connection limits
  maxConnections: 1000,              // Global connection limit
  maxConnectionsPerIP: 10,           // Per-IP connection limit
  
  // Timeouts
  idleTimeout: 300000,               // 5 minutes idle timeout
  upgradeTimeout: 5000,              // 5 second upgrade timeout
  
  // Rate limiting
  rateLimitWindow: 60000,            // 1 minute rate limit window
  rateLimitMaxConnections: 5,        // Max 5 connections per IP per minute
  
  // Background services
  healthCheckInterval: 30000,        // Health checks every 30 seconds
  cleanupInterval: 60000,            // Cleanup every minute
  
  // Feature toggles
  enablePooling: true,
  enableRateLimit: true,
  enableHealthMonitoring: true,
  
  // Custom cleanup policy
  customCleanupPolicy: (connection) => {
    // Close connections tagged as 'temporary' after 5 minutes
    return connection.tags.has('temporary') && connection.age > 300000;
  }
};

// Initialize connection manager with configuration
const connectionManager = getConnectionManager(connectionConfig);

// Set up event listeners for monitoring
connectionManager.on('connection:added', (connection) => {
  console.log(`[ConnectionManager] New connection: ${connection.id} from ${connection.remoteAddress}`);
});

connectionManager.on('connection:removed', (connectionId, reason) => {
  console.log(`[ConnectionManager] Connection removed: ${connectionId}, reason: ${reason}`);
});

connectionManager.on('pool:full', (rejectedConnection) => {
  console.warn(`[ConnectionManager] Connection pool full, rejected connection from ${rejectedConnection.ip}`);
});

connectionManager.on('ratelimit:exceeded', (ip, attempt) => {
  console.warn(`[ConnectionManager] Rate limit exceeded for IP ${ip}, attempt ${attempt}`);
});

connectionManager.on('cleanup:completed', (removedCount) => {
  console.log(`[ConnectionManager] Cleanup completed, removed ${removedCount} connections`);
});

// Astro configuration
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    {
      name: 'advanced-websocket-manager',
      hooks: {
        'astro:server:setup': ({ server }) => {
          // Log connection stats periodically
          setInterval(() => {
            const stats = ConnectionManagerAPI.getStats();
            console.log(`[ConnectionManager] Active: ${stats.totalManagedConnections}, Rate limit buckets: ${stats.rateLimitBuckets}`);
            console.log(`[ConnectionManager] Health status: ${JSON.stringify(stats.healthStats)}`);
          }, 30000);
          
          // Graceful shutdown handler
          const gracefulShutdown = async (signal: string) => {
            console.log(`[ConnectionManager] Received ${signal}, starting graceful shutdown...`);
            await ConnectionManagerAPI.shutdown({
              timeout: 10000,
              closeCode: 1001,
              closeReason: 'Server shutting down'
            });
            console.log('[ConnectionManager] Graceful shutdown completed');
          };
          
          process.on('SIGINT', () => gracefulShutdown('SIGINT'));
          process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        }
      }
    }
  ]
});

// Example WebSocket API route with advanced connection management
// File: src/pages/api/advanced-websocket.ts
/*
import type { APIRoute } from "astro";
import { ConnectionManagerAPI } from 'zastro-websockets-node/connection-manager';

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.isUpgradeRequest) {
    return new Response("Upgrade required", { status: 426 });
  }

  // Check if connection can be accepted before upgrading
  const manager = ConnectionManagerAPI.getInstance();
  const remoteAddress = ctx.request.headers.get('x-forwarded-for') || 'unknown';
  
  const canAccept = manager.canAcceptConnection(remoteAddress);
  if (!canAccept.allowed) {
    return new Response(`Connection rejected: ${canAccept.reason}`, { 
      status: 429, // Too Many Requests
      headers: { 'Retry-After': '60' }
    });
  }

  const { response, socket } = ctx.locals.upgradeWebSocket();
  
  // The socket will be automatically registered with the ConnectionManager
  // via the attach function, but we can add additional tags and metadata
  
  socket.addEventListener('open', () => {
    console.log('Advanced WebSocket connection opened');
    
    // Add custom tags and metadata to the connection
    const connectionId = getConnectionId(socket);
    if (connectionId) {
      manager.addConnectionTag(connectionId, 'api-connection');
      manager.addConnectionTag(connectionId, 'user-session');
      manager.setConnectionData(connectionId, 'route', '/api/advanced-websocket');
      manager.setConnectionData(connectionId, 'sessionStart', Date.now());
    }
  });
  
  socket.addEventListener('message', (event) => {
    console.log('Message received:', event.data);
    
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'ping':
          socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        case 'get_stats':
          const stats = ConnectionManagerAPI.getStats();
          socket.send(JSON.stringify({ type: 'stats', data: stats }));
          break;
          
        case 'health_check':
          socket.send(JSON.stringify({ 
            type: 'health', 
            status: 'healthy', 
            timestamp: Date.now() 
          }));
          break;
          
        case 'tag_temporary':
          // Mark this connection as temporary for custom cleanup
          const connectionId = getConnectionId(socket);
          if (connectionId) {
            manager.addConnectionTag(connectionId, 'temporary');
          }
          socket.send(JSON.stringify({ type: 'tagged', tag: 'temporary' }));
          break;
          
        default:
          socket.send(JSON.stringify({ type: 'echo', data: message }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });
  
  socket.addEventListener('close', () => {
    console.log('Advanced WebSocket connection closed');
  });
  
  socket.addEventListener('error', (error) => {
    console.error('Advanced WebSocket error:', error);
  });
  
  return response;
};
*/

// Example admin dashboard API for connection management
// File: src/pages/api/admin/connections.ts
/*
import type { APIRoute } from "astro";
import { ConnectionManagerAPI } from 'zastro-websockets-node/connection-manager';

export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get('action');
  const manager = ConnectionManagerAPI.getInstance();
  
  switch (action) {
    case 'stats':
      const stats = ConnectionManagerAPI.getStats();
      const connections = manager.getAllManagedConnections().map(conn => ({
        id: conn.id,
        ip: conn.remoteAddress,
        age: conn.age,
        idleTime: conn.idleTime,
        state: conn.state,
        healthStatus: conn.healthStatus,
        tags: Array.from(conn.tags),
        poolGroup: conn.poolGroup,
        priority: conn.priority
      }));
      
      return new Response(JSON.stringify({
        success: true,
        stats,
        connections
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    case 'health':
      const healthResults = await ConnectionManagerAPI.healthCheck();
      return new Response(JSON.stringify({
        success: true,
        healthResults
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Unknown action'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, criteria, ...options } = body;
    
    switch (action) {
      case 'close_connections':
        const closedCount = ConnectionManagerAPI.closeConnections(
          criteria || {},
          options.code,
          options.reason
        );
        
        return new Response(JSON.stringify({
          success: true,
          closedCount
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case 'update_config':
        const manager = ConnectionManagerAPI.getInstance();
        manager.updateConfig(options.config || {});
        
        return new Response(JSON.stringify({
          success: true,
          config: manager.getConfig()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Unknown action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
*/

// Example of using ConnectionManager for load balancing
// File: src/pages/api/load-balanced-websocket.ts
/*
import type { APIRoute } from "astro";
import { ConnectionManagerAPI } from 'zastro-websockets-node/connection-manager';

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.isUpgradeRequest) {
    return new Response("Upgrade required", { status: 426 });
  }

  const { response, socket } = ctx.locals.upgradeWebSocket();
  const manager = ConnectionManagerAPI.getInstance();
  
  socket.addEventListener('open', () => {
    console.log('Load-balanced WebSocket connection opened');
    
    // Assign to load balancing pool based on current load
    const stats = ConnectionManagerAPI.getStats();
    const poolGroup = stats.totalManagedConnections < 100 ? 'pool-a' : 'pool-b';
    
    const connectionId = getConnectionId(socket);
    if (connectionId) {
      const connection = manager.getManagedConnection(connectionId);
      if (connection) {
        connection.poolGroup = poolGroup;
        manager.addConnectionTag(connectionId, 'load-balanced');
        manager.addConnectionTag(connectionId, poolGroup);
        manager.setConnectionData(connectionId, 'assignedPool', poolGroup);
      }
    }
    
    socket.send(JSON.stringify({ 
      type: 'connected', 
      pool: poolGroup,
      connectionId 
    }));
  });
  
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'broadcast_to_pool') {
        // Broadcast message to all connections in the same pool
        const connectionId = getConnectionId(socket);
        const connection = manager.getManagedConnection(connectionId);
        
        if (connection && connection.poolGroup) {
          const poolConnections = manager.getConnectionsByPoolGroup(connection.poolGroup);
          
          poolConnections.forEach(poolConn => {
            if (poolConn.id !== connectionId && poolConn.state === 'OPEN') {
              try {
                poolConn.socket.send(JSON.stringify({
                  type: 'pool_broadcast',
                  from: connectionId,
                  message: message.data
                }));
              } catch (error) {
                console.error(`Failed to broadcast to connection ${poolConn.id}:`, error);
              }
            }
          });
        }
      } else {
        // Echo regular messages
        socket.send(JSON.stringify({ type: 'echo', data: message }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  return response;
};
*/

// Example middleware for connection analytics
// File: src/middleware/connection-analytics.ts
/*
import { ConnectionManagerAPI } from 'zastro-websockets-node/connection-manager';

export const onRequest = async (context, next) => {
  // Add connection analytics to all pages
  const stats = ConnectionManagerAPI.getStats();
  
  context.locals.connectionAnalytics = {
    totalConnections: stats.totalManagedConnections,
    connectionsByIP: stats.connectionsByIP,
    healthStats: stats.healthStats,
    poolStats: stats.poolStats,
    getDetailedStats: () => ConnectionManagerAPI.getStats(),
    getConnectionsByTag: (tag: string) => {
      const manager = ConnectionManagerAPI.getInstance();
      return manager.getConnectionsByTag(tag);
    }
  };
  
  return next();
};
*/