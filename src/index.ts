/**
 * Zastro WebSockets - Add WebSocket support to your Astro application
 * 
 * Self-contained WebSocket adapters - no integration needed!
 * Just import the patched adapters directly:
 * 
 * import node from 'zastro-websockets/node'
 * import cloudflare from 'zastro-websockets/cloudflare'
 */

// Export all types for advanced users
export type * from './types.js'

// Export WebSocket utilities for advanced users
export { UpgradeResponse } from './response.js'
export type { WebSocket } from './types.js'

// Ensure global types are available
import './types.js'