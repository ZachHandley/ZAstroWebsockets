/**
 * TypeScript type definitions for Astro.locals integration
 * with WebSocket middleware functionality
 */

import type { WebSocketStatsLocals } from './index.js';

// Import existing types to avoid conflicts
import type { WebSocketUpgrade } from '../types.js';

// Extend Astro's namespace with WebSocket functionality
declare global {
  namespace App {
    interface Locals {
      /**
       * Enhanced WebSocket statistics and management functionality
       * Available when using createStatsMiddleware() or similar middleware functions
       */
      websocketStats?: WebSocketStatsLocals;
    }
  }
}

/**
 * Type helper for components that expect WebSocket stats to be available
 */
export type WithWebSocketStats<T = {}> = T & {
  locals: {
    websocketStats: WebSocketStatsLocals;
  } & App.Locals;
};

/**
 * Type guard to check if WebSocket stats are available
 */
export function hasWebSocketStats(locals: App.Locals): locals is App.Locals & { websocketStats: WebSocketStatsLocals } {
  return locals.websocketStats !== undefined;
}

/**
 * Type helper for API routes that use WebSocket stats
 */
export interface APIContextWithWebSocketStats {
  locals: App.Locals & { 
    websocketStats: WebSocketStatsLocals;
  };
  request: Request;
  params: Record<string, string | undefined>;
  url: URL;
  clientAddress: string;
  generator: string;
  props: Record<string, any>;
  redirect: (path: string, status?: number) => Response;
  rewrite: (reroutePayload: string | URL | Request) => Promise<Response>;
}

/**
 * Type for middleware context with WebSocket stats
 */
export interface MiddlewareContextWithWebSocketStats {
  locals: App.Locals & { 
    websocketStats: WebSocketStatsLocals;
  };
  request: Request;
  url: URL;
  params: Record<string, string | undefined>;
  clientAddress: string;
  generator: string;
  props: Record<string, any>;
  redirect: (path: string, status?: number) => Response;
  rewrite: (reroutePayload: string | URL | Request) => Promise<Response>;
}

export {}; // Make this a module