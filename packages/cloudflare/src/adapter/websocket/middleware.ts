/**
 * Cloudflare WebSocket middleware
 */

import { WebSocket, attach } from './websocket.js'

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
    const [client, server] = Object.values(webSocketPair)

    // Create our WebSocket wrapper
    const socket = new WebSocket(request.url)

    // Attach the server-side WebSocket to our wrapper
    attach(socket, server)

    // Return WebSocket upgrade response
    const response = new Response(null, {
      status: 101,
      statusText: 'Switching Protocols',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
      // @ts-expect-error Cloudflare specific WebSocket property
      webSocket: client,
    })

    return { socket, response }
  }

  return next()
}

// Add WebSocket types for Cloudflare
declare global {
  interface WebSocketPair {
    0: CloudflareWebSocket
    1: CloudflareWebSocket
  }

  var WebSocketPair: {
    new (): WebSocketPair
  }
