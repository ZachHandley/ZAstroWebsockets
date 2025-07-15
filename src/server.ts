/**
 * Server utilities - re-export from patched adapter
 */

export { createWebsocketHandler } from './adapters/patched/node/websocket/serve-websocket.js'
export type { UpgradeHandler } from './adapters/patched/node/websocket/serve-websocket.js'