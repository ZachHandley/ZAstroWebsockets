import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

// WeakMap to store private WebSocket instances
const wsMap = new WeakMap<WebSocket, ws.WebSocket>()

// Hidden attachment function
const attacher: { attach: null | typeof attachImpl } = { attach: null }

function attachImpl(standard: WebSocket, ws: ws.WebSocket): void {
    if (wsMap.has(standard)) {
        throw new Error("WebSocket already attached")
    }
    wsMap.set(standard, ws)
}

// Initialize the attacher
attacher.attach = attachImpl

export function attach(standard: WebSocket, ws: ws.WebSocket): void {
    return attacher.attach?.(standard, ws)
}