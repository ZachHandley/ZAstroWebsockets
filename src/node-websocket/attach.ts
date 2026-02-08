import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

/**
 * To keep the internals hidden, the function that attaches the
 * ws.WebSocket to the WebSocket instance is created within
 * WebSocket's static block, and assigned to this variable.
 */
export const attacher: { attach: null | typeof attach } = { attach: null }

/**
 * Attach a ws.WebSocket connected to I/O to the implementation
 * of the standard WebSocket class exposed to the public API.
 */
export function attach(standard: WebSocket, ws: ws.WebSocket): void {
    return attacher.attach?.(standard, ws)
}
