/**
 * WebSocket functionality for zastro-websockets-node
 */

export { WebSocket, ErrorEvent, CloseEvent, attach } from './websocket.js'
export { UpgradeResponse } from './response.js'
export { 
  WebSocketStats, 
  registerConnection, 
  updateConnectionActivity, 
  logConnectionStats,
  createStatsMiddleware,
  type ConnectionMetadata,
  type ConnectionStats
} from './stats.js'
export { 
  ConnectionManager,
  ConnectionManagerAPI,
  getConnectionManager,
  resetConnectionManager,
  type ConnectionManagerConfig,
  type ManagedConnection,
  type ConnectionPoolConfig
} from './connection-manager.js'
export { getConnectionId, getWsSocket } from './attach.js'
export { onRequest as websocketDevMiddleware, handleUpgradeRequests } from './dev-middleware.js'
export { createWebsocketHandler } from './serve-websocket.js'

// Export enhanced middleware functionality
export { 
  createStatsMiddleware as createEnhancedStatsMiddleware,
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
} from '../middleware/index.js'

// Import for re-export
import { WebSocketStats } from './stats.js'

// Re-export main stats API for convenience
export default WebSocketStats