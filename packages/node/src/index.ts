// Export Node.js specific adapter
export { default } from './adapter/index.js';
export * from './adapter/index.js';

// Export types
export * from './types.js';

// Export WebSocket functionality (without conflicts)
export { 
  WebSocket as ZastroWebSocket, 
  ErrorEvent, 
  CloseEvent,
  attach
} from './websocket/websocket.js';
export { UpgradeResponse as WebSocketUpgradeResponse } from './websocket/response.js';
export { 
  WebSocketStats, 
  registerConnection, 
  updateConnectionActivity, 
  logConnectionStats,
  type ConnectionMetadata,
  type ConnectionStats
} from './websocket/stats.js';
export { getConnectionId, getWsSocket } from './websocket/attach.js';
export { onRequest as websocketDevMiddleware, handleUpgradeRequests } from './websocket/dev-middleware.js';
export { createWebsocketHandler } from './websocket/serve-websocket.js';

// Export connection manager functionality
export { 
  ConnectionManager,
  ConnectionManagerAPI,
  getConnectionManager,
  resetConnectionManager,
  type ConnectionManagerConfig,
  type ManagedConnection,
  type ConnectionPoolConfig
} from './websocket/connection-manager.js';

// Export enhanced middleware functionality
export { 
  createStatsMiddleware,
  createAdvancedStatsMiddleware,
  createBasicStatsMiddleware,
  createDevStatsMiddleware,
  trackConnectionForPage,
  untrackConnectionForPage,
  getPageConnectionCounts,
  clearPageTracking,
  hasWebSocketStats,
  type StatsMiddlewareConfig,
  type WebSocketStatsLocals,
  type WithWebSocketStats,
  type APIContextWithWebSocketStats,
  type MiddlewareContextWithWebSocketStats
} from './middleware/index.js';