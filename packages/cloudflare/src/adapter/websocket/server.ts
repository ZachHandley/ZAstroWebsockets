/**
 * Cloudflare WebSocket server entrypoint
 */

import type { CloudflareApp } from '../utils/handler.js'
import { WebSocket, attach } from './websocket.js'

export function createWebSocketHandler(app: CloudflareApp) {
  return async function handleWebSocket(request: Request, env: any, ctx: any) {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('upgrade')
    const connectionHeader = request.headers.get('connection')

    if (upgradeHeader !== 'websocket' || !connectionHeader?.toLowerCase().includes('upgrade')) {
      // Not a WebSocket upgrade request, handle normally
      return app.render(request, { locals: { isUpgradeRequest: false } })
    }

    // Create WebSocket pair for Cloudflare
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Render the Astro page with WebSocket support
    const response = await app.render(request, {
      locals: {
        isUpgradeRequest: true,
        upgradeWebSocket() {
          // Create our WebSocket wrapper
          const socket = new WebSocket(request.url)

          // Attach the server-side WebSocket to our wrapper
          attach(socket, server)

          // Return WebSocket upgrade response
          const upgradeResponse = new Response(null, {
            status: 101,
            statusText: 'Switching Protocols',
            headers: {
              'Upgrade': 'websocket',
              'Connection': 'Upgrade',
            },
            // @ts-expect-error Cloudflare specific WebSocket property
            webSocket: client,
          })

          return { socket, response: upgradeResponse }
        },
        runtime: {
          env,
          cf: request.cf,
          ctx,
          caches: (globalThis as any).caches,
          waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        },
      },
    })

    // If the response is a WebSocket upgrade response, accept the connection
    if (response.status === 101 && response.headers.get('upgrade') === 'websocket') {
      // Accept the WebSocket connection
      server.accept()

      // Return the response with the client WebSocket
      return new Response(null, {
        status: 101,
        statusText: 'Switching Protocols',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
        },
        // @ts-expect-error Cloudflare specific WebSocket property
        webSocket: client,
      })
    }

    return response
  }
}

// Re-export WebSocket types for convenience
export { WebSocket, attach } from './websocket.js'

// Add WebSocket types for Cloudflare
declare global {
  interface WebSocketPair {
    0: CloudflareWebSocket
    1: CloudflareWebSocket
  }

  var WebSocketPair: {
    new (): WebSocketPair
  }

  interface CloudflareWebSocket {
    send(data: string | ArrayBufferLike | ArrayBufferView): void
    close(code?: number, reason?: string): void
    addEventListener(type: 'message', listener: (event: { data: any }) => void): void
    addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
    addEventListener(type: 'error', listener: (event: any) => void): void
    accept(): void
  }
}
