/**
 * Cloudflare WebSocket middleware
 */

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

// Extend ResponseInit to include Cloudflare's webSocket property
interface CloudflareResponseInit extends ResponseInit {
  webSocket?: CloudflareWebSocket
}

export interface CloudflareLocals {
  isUpgradeRequest: boolean
  upgradeWebSocket(): { socket: WebSocket, response: Response }
  runtime?: {
    env: any
    cf: any
    ctx: any
    caches: any
    waitUntil: (promise: Promise<any>) => void
  }
}

export const onRequest = async function cloudflareWebSocketMiddleware(
  context: any,
  next: () => Promise<Response>
): Promise<Response> {
  const { request, locals } = context

  // Check if this is a WebSocket upgrade request
  const isUpgradeRequest =
    request.headers.get('upgrade') === 'websocket' &&
    request.headers.get('connection')?.toLowerCase().includes('upgrade')

  // Set up locals for WebSocket support
  locals.isUpgradeRequest = isUpgradeRequest
  locals.upgradeWebSocket = () => {
    if (!isUpgradeRequest) {
      throw new Error('The request must be an upgrade request to upgrade the connection to a WebSocket.')
    }

    // Create WebSocket pair for Cloudflare
    const webSocketPair = new WebSocketPair()
    const [client, server] = [webSocketPair[0], webSocketPair[1]]

    // CRITICAL: Accept the server-side WebSocket BEFORE attaching
    server.accept()

    // Create our WebSocket wrapper
    const socket = new WebSocket(request.url)

    // Attach the server-side WebSocket to our wrapper
    attach(socket, server)

    // Return WebSocket upgrade response with client side
    const response = new Response(null, {
      status: 101,
      statusText: 'Switching Protocols',
      webSocket: client,
    } as CloudflareResponseInit)

    return { socket, response }
  }

  return next()
}
