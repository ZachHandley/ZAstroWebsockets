import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"
import { registerConnection } from "./stats.js"

// WeakMap to store private WebSocket instances
const wsMap = new WeakMap<WebSocket, ws.WebSocket>()
// WeakMap to store connection IDs for stats tracking
const connectionIdMap = new WeakMap<WebSocket, string>()

// Hidden attachment function
const attacher: { attach: null | typeof attachImpl } = { attach: null }

function attachImpl(standard: WebSocket, ws: ws.WebSocket, req?: import('node:http').IncomingMessage): void {
    if (wsMap.has(standard)) {
        throw new Error("WebSocket already attached")
    }
    wsMap.set(standard, ws)
    
    // Register connection with stats system
    try {
        const connectionId = registerConnection(standard, ws, req)
        connectionIdMap.set(standard, connectionId)
        
        // Track page connection if middleware page tracking is available
        try {
            // Get referrer from request to determine the page that initiated the WebSocket
            const referer = req?.headers.referer || req?.headers.origin
            if (referer) {
                const url = new URL(referer)
                const pageId = `${url.pathname}${url.search}`
                
                // Dynamically import middleware tracking function (non-blocking)
                import('../middleware/index.js')
                    .then(({ trackConnectionForPage }) => {
                        trackConnectionForPage(connectionId, pageId)
                    })
                    .catch(() => {
                        // Middleware tracking not available - this is non-critical
                    })
            }
        } catch (error) {
            // Page tracking failed - this is non-critical
        }
        
        // Also register with connection manager if available (async but non-blocking)
        import('./connection-manager.js')
            .then(({ getConnectionManager }) => {
                const manager = getConnectionManager()
                return manager.registerManagedConnection(standard, ws, req, {
                    tags: ['attached'],
                    priority: 5
                })
            })
            .catch(() => {
                // Connection manager not available or failed - this is non-critical
                // Just continue with basic stats tracking
            })
    } catch (error) {
        console.warn('[WebSocket] Failed to register connection with stats system:', error)
    }
}

// Initialize the attacher
attacher.attach = attachImpl

export function attach(standard: WebSocket, ws: ws.WebSocket, req?: import('node:http').IncomingMessage): void {
    return attacher.attach?.(standard, ws, req)
}

/**
 * Get connection ID for a WebSocket instance
 */
export function getConnectionId(socket: WebSocket): string | undefined {
    return connectionIdMap.get(socket)
}

/**
 * Get underlying ws.WebSocket for a WebSocket instance
 */
export function getWsSocket(socket: WebSocket): ws.WebSocket | undefined {
    return wsMap.get(socket)
}