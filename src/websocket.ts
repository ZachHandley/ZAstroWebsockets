/**
 * WebSocket implementation - re-export from patched adapter
 */

export { WebSocket, attach } from './adapters/patched/node/websocket/websocket.js'
export type { WebSocket as IWebSocket } from './types.js'