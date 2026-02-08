/**
 * Cloudflare WebSocket server entrypoint
 */

import type { App } from 'astro/app'
import { WebSocket, attach } from './websocket.js'

// Cloudflare Workers type declarations
declare global {
  var WebSocketPair: {
    new (): {
      0: CloudflareWebSocket
      1: CloudflareWebSocket
    }
  }

  interface CloudflareWebSocket {
    send(data: string | ArrayBufferLike | ArrayBufferView): void
    close(code?: number, reason?: string): void
    accept(): void
    addEventListener(type: 'message', listener: (event: { data: any }) => void): void
    addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
    addEventListener(type: 'error', listener: (event: any) => void): void
    addEventListener(type: 'open', listener: (event: any) => void): void
    removeEventListener(type: string, listener: any): void
    readonly readyState: number
    readonly url: string
  }
}

// Extend Request to include Cloudflare's cf property
interface CloudflareRequest extends Request {
  cf: any
}

// Extend ResponseInit to include Cloudflare's webSocket property
interface CloudflareResponseInit extends ResponseInit {
  webSocket?: CloudflareWebSocket
}

export type CloudflareApp = App

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
    const [client, server] = [webSocketPair[0], webSocketPair[1]]

    // Accept the server-side WebSocket
    server.accept()

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
            webSocket: client,
          } as CloudflareResponseInit)

          return { socket, response: upgradeResponse }
        },
        runtime: {
          env,
          cf: (request as CloudflareRequest).cf,
          ctx,
          caches: globalThis.caches,
          waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        },
      },
    })

    // If the response is a WebSocket upgrade response, return it with the client WebSocket
    if (response.status === 101) {
      return new Response(null, {
        status: 101,
        statusText: 'Switching Protocols',
        webSocket: client,
      } as CloudflareResponseInit)
    }

    return response
  }
}

// Re-export WebSocket types for convenience
export { WebSocket, attach } from './websocket.js'
