/**
 * Enhanced middleware for Astro applications with automatic WebSocket tracking
 * and integration. Provides WebSocket stats in Astro.locals.websocketStats.
 */

import type { MiddlewareHandler } from 'astro';
import { WebSocketStats, logConnectionStats, type ConnectionStats } from '../websocket/stats.js';
import { 
  ConnectionManagerAPI, 
  getConnectionManager, 
  type ConnectionManagerConfig,
  type ManagedConnection 
} from '../websocket/connection-manager.js';

/**
 * Configuration options for the stats middleware
 */
export interface StatsMiddlewareConfig {
  /** Whether to include detailed connection information (default: true) */
  includeDetailedStats?: boolean;
  /** Whether to include connection manager stats (default: true) */
  includeManagerStats?: boolean;
  /** Whether to include real-time connection count (default: true) */
  includeConnectionCount?: boolean;
  /** Whether to include connection IDs (default: false, for privacy) */
  includeConnectionIds?: boolean;
  /** Whether to include IP addresses in stats (default: false, for privacy) */
  includeIPAddresses?: boolean;
  /** Whether to include user agents (default: false, for privacy) */
  includeUserAgents?: boolean;
  /** Custom filter function for connections */
  connectionFilter?: (connection: ManagedConnection) => boolean;
  /** Whether to enable automatic logging (default: false in middleware) */
  enableLogging?: boolean;
  /** Log interval in milliseconds (default: 30000) */
  logInterval?: number;
  /** Whether to track page-specific connection counts (default: true) */
  trackPageConnections?: boolean;
  /** Whether to provide helper functions in locals (default: true) */
  includeHelperFunctions?: boolean;
}

/**
 * WebSocket stats interface available in Astro.locals
 */
export interface WebSocketStatsLocals {
  /** Get current connection count */
  getConnectionCount(): number;
  /** Get detailed connection statistics */
  getConnectionStats(): ConnectionStats;
  /** Get connection manager statistics (if enabled) */
  getManagerStats?(): ReturnType<typeof ConnectionManagerAPI.getStats>;
  /** Get connections for current page/route (if page tracking enabled) */
  getPageConnections?(): ManagedConnection[];
  /** Get filtered connections based on middleware config */
  getFilteredConnections(): any[];
  /** Helper to check if WebSocket functionality is available */
  isWebSocketEnabled(): boolean;
  /** Helper to get connection count by status */
  getConnectionsByStatus(): Record<string, number>;
  /** Configuration used by this middleware instance */
  config: Required<StatsMiddlewareConfig>;
}

/**
 * Page connection tracking store
 */
const pageConnectionTracker = new Map<string, Set<string>>();

/**
 * Create enhanced middleware that provides automatic WebSocket tracking
 * and integration with Astro applications
 */
export function createStatsMiddleware(config: StatsMiddlewareConfig = {}): MiddlewareHandler {
  const middlewareConfig: Required<StatsMiddlewareConfig> = {
    includeDetailedStats: config.includeDetailedStats ?? true,
    includeManagerStats: config.includeManagerStats ?? true,
    includeConnectionCount: config.includeConnectionCount ?? true,
    includeConnectionIds: config.includeConnectionIds ?? false,
    includeIPAddresses: config.includeIPAddresses ?? false,
    includeUserAgents: config.includeUserAgents ?? false,
    connectionFilter: config.connectionFilter ?? (() => true),
    enableLogging: config.enableLogging ?? false,
    logInterval: config.logInterval ?? 30000,
    trackPageConnections: config.trackPageConnections ?? true,
    includeHelperFunctions: config.includeHelperFunctions ?? true,
  };

  // Set up logging if enabled
  let loggingInterval: NodeJS.Timeout | undefined;
  if (middlewareConfig.enableLogging) {
    loggingInterval = setInterval(() => {
      logConnectionStats();
    }, middlewareConfig.logInterval);
  }

  // Cleanup function for when the server shuts down
  const cleanup = () => {
    if (loggingInterval) {
      clearInterval(loggingInterval);
    }
    pageConnectionTracker.clear();
  };

  // Handle process shutdown
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return async (context, next) => {
    const { request, locals, url } = context;
    
    // Get current page/route identifier for tracking
    const pageId = middlewareConfig.trackPageConnections ? 
      `${url.pathname}${url.search}` : 'default';

    // Create WebSocket stats locals object
    const websocketStats: WebSocketStatsLocals = {
      getConnectionCount(): number {
        if (!middlewareConfig.includeConnectionCount) return 0;
        return WebSocketStats.getConnectionCount();
      },

      getConnectionStats(): ConnectionStats {
        const stats = WebSocketStats.getConnectionStats();
        
        if (!middlewareConfig.includeDetailedStats) {
          // Return minimal stats
          return {
            ...stats,
            connections: []
          };
        }

        // Filter connections based on privacy settings
        const filteredConnections = stats.connections.map(conn => ({
          id: middlewareConfig.includeConnectionIds ? conn.id : '[hidden]',
          age: conn.age,
          idleTime: conn.idleTime,
          state: conn.state,
          remoteAddress: middlewareConfig.includeIPAddresses ? conn.remoteAddress : undefined,
          userAgent: middlewareConfig.includeUserAgents ? conn.userAgent : undefined,
        }));

        return {
          ...stats,
          connections: filteredConnections
        };
      },

      getFilteredConnections(): any[] {
        try {
          const manager = getConnectionManager();
          const connections = manager.getAllManagedConnections();
          const filtered = connections.filter(middlewareConfig.connectionFilter);
          
          return filtered.map(conn => ({
            id: middlewareConfig.includeConnectionIds ? conn.id : '[hidden]',
            age: conn.age,
            idleTime: conn.idleTime,
            state: conn.state,
            healthStatus: conn.healthStatus,
            priority: conn.priority,
            tags: Array.from(conn.tags),
            poolGroup: conn.poolGroup,
            remoteAddress: middlewareConfig.includeIPAddresses ? conn.remoteAddress : undefined,
            userAgent: middlewareConfig.includeUserAgents ? conn.userAgent : undefined,
          }));
        } catch (error) {
          console.warn('Error getting filtered connections:', error);
          return [];
        }
      },

      isWebSocketEnabled(): boolean {
        return !WebSocketStats.isShutDown;
      },

      getConnectionsByStatus(): Record<string, number> {
        const stats = this.getConnectionStats();
        return stats.connectionsByState;
      },

      config: middlewareConfig
    };

    // Add manager stats if enabled
    if (middlewareConfig.includeManagerStats) {
      websocketStats.getManagerStats = () => {
        try {
          return ConnectionManagerAPI.getStats();
        } catch (error) {
          console.warn('Error getting manager stats:', error);
          return {
            totalManagedConnections: 0,
            connectionsByIP: 0,
            rateLimitBuckets: 0,
            healthStats: {},
            poolStats: {},
            idleConnections: 0,
            config: {} as any,
            isShutdown: true
          };
        }
      };
    }

    // Add page connection tracking if enabled
    if (middlewareConfig.trackPageConnections) {
      websocketStats.getPageConnections = () => {
        try {
          const manager = getConnectionManager();
          const pageConnections = pageConnectionTracker.get(pageId) || new Set();
          
          return Array.from(pageConnections)
            .map(id => manager.getManagedConnection(id))
            .filter((conn): conn is ManagedConnection => conn !== undefined)
            .filter(middlewareConfig.connectionFilter);
        } catch (error) {
          console.warn('Error getting page connections:', error);
          return [];
        }
      };
    }

    // Add to Astro.locals
    locals.websocketStats = websocketStats;

    // Proceed with the request
    const response = await next();

    // Track any new WebSocket connections that might have been created during this request
    if (middlewareConfig.trackPageConnections && locals.isUpgradeRequest) {
      // This would be called after a WebSocket upgrade
      // We'll add a hook for this in the WebSocket attachment code
      try {
        const connectionIds = WebSocketStats.getConnectionIds();
        if (!pageConnectionTracker.has(pageId)) {
          pageConnectionTracker.set(pageId, new Set());
        }
        // Add the most recent connection (this is a best-effort approach)
        const latestId = connectionIds[connectionIds.length - 1];
        if (latestId) {
          pageConnectionTracker.get(pageId)!.add(latestId);
        }
      } catch (error) {
        console.warn('Error tracking page connection:', error);
      }
    }

    return response;
  };
}

/**
 * Create middleware with connection manager integration
 */
export function createAdvancedStatsMiddleware(
  config: StatsMiddlewareConfig = {},
  managerConfig: ConnectionManagerConfig = {}
): MiddlewareHandler {
  // Initialize connection manager with provided config
  getConnectionManager(managerConfig);
  
  return createStatsMiddleware({
    includeManagerStats: true,
    ...config
  });
}

/**
 * Create basic middleware with minimal configuration for production
 */
export function createBasicStatsMiddleware(): MiddlewareHandler {
  return createStatsMiddleware({
    includeDetailedStats: false,
    includeConnectionIds: false,
    includeIPAddresses: false,
    includeUserAgents: false,
    includeManagerStats: false,
    trackPageConnections: false,
    enableLogging: false
  });
}

/**
 * Create development middleware with full features enabled
 */
export function createDevStatsMiddleware(): MiddlewareHandler {
  return createStatsMiddleware({
    includeDetailedStats: true,
    includeConnectionIds: true,
    includeIPAddresses: true,
    includeUserAgents: true,
    includeManagerStats: true,
    trackPageConnections: true,
    enableLogging: true,
    logInterval: 15000 // More frequent logging in dev
  });
}

/**
 * Utility function to add connection to page tracking
 * This should be called from the WebSocket attachment code
 */
export function trackConnectionForPage(connectionId: string, pageId: string): void {
  if (!pageConnectionTracker.has(pageId)) {
    pageConnectionTracker.set(pageId, new Set());
  }
  pageConnectionTracker.get(pageId)!.add(connectionId);
}

/**
 * Utility function to remove connection from page tracking
 */
export function untrackConnectionForPage(connectionId: string, pageId?: string): void {
  if (pageId) {
    const pageConnections = pageConnectionTracker.get(pageId);
    if (pageConnections) {
      pageConnections.delete(connectionId);
      if (pageConnections.size === 0) {
        pageConnectionTracker.delete(pageId);
      }
    }
  } else {
    // Remove from all pages
    for (const [page, connections] of pageConnectionTracker.entries()) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        pageConnectionTracker.delete(page);
      }
    }
  }
}

/**
 * Get all tracked pages and their connection counts
 */
export function getPageConnectionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [pageId, connections] of pageConnectionTracker.entries()) {
    counts[pageId] = connections.size;
  }
  return counts;
}

/**
 * Clear all page connection tracking
 */
export function clearPageTracking(): void {
  pageConnectionTracker.clear();
}

// Export types for external use
export type {
  WithWebSocketStats,
  APIContextWithWebSocketStats,
  MiddlewareContextWithWebSocketStats
} from './types.js';
export { hasWebSocketStats } from './types.js';

/**
 * Type augmentation for Astro locals
 */
declare global {
  namespace App {
    interface Locals {
      websocketStats?: WebSocketStatsLocals;
    }
  }
}

export default createStatsMiddleware;