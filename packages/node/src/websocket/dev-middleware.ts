import { AsyncLocalStorage } from 'node:async_hooks'
import * as ws from 'ws'

// Type definitions for Vite dev server
export interface ViteDevServer {
  httpServer: import('node:http').Server
  middlewares: {
    stack: Array<{
      handle: any
    }>
  }
}

// Type for Astro dev handler
type AstroDevHandler = (
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
) => void

// Global storage for upgrade requests
const upgradeRequestStorage = new AsyncLocalStorage<[
  wsServer: ws.WebSocketServer,
  req: import('node:http').IncomingMessage,
  socket: import('node:stream').Duplex,
  head: Buffer
]>()

/**
 * Development middleware for handling WebSocket upgrade requests
 */
export const onRequest = async function websocketDevMiddleware(
  context: any,
  next: () => Promise<Response>
): Promise<Response> {
  const upgradeRequest = upgradeRequestStorage.getStore()

  // Non-upgrade request handling
  if (upgradeRequest === undefined) {
    // Check if this is a WebSocket upgrade request
    const isUpgradeRequest = context.request.headers.get('upgrade') === 'websocket'

    // Set up locals for non-upgrade requests
    context.locals.isUpgradeRequest = isUpgradeRequest
    context.locals.upgradeWebSocket = () => {
      throw new Error('The request must be an upgrade request to upgrade the connection to a WebSocket.')
    }

    return next()
  }

  // This is an upgrade request - the actual handling happens in the upgrade event handler
  return new Response(null, { status: 101 })
}

/**
 * Set up WebSocket upgrade handling for Vite dev server
 */
export function handleUpgradeRequests(viteDevServer: ViteDevServer): void {
  // Find the Astro dev handler in the middleware stack
  const astroDevHandler = viteDevServer.middlewares.stack
    .find((stackItem: any) =>
      'name' in stackItem.handle && stackItem.handle.name === 'astroDevHandler'
    )?.handle as AstroDevHandler

  if (!astroDevHandler) {
    console.warn('[node-websocket] Astro dev handler not found in Vite middleware stack')
    return
  }

  // Create WebSocket server with noServer option
  const wsServer = new ws.WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 64 * 1024 * 1024, // 64MB max payload
  })

  // Handle server lifecycle
  wsServer.on('error', (error) => {
    console.error('[node-websocket] WebSocket server error:', error)
  })

  // Get the HTTP server instance
  const httpServer = viteDevServer.httpServer

  if (!httpServer) {
    console.warn('[node-websocket] No HTTP server found, WebSocket upgrade handling may not work')
    return
  }

  // Set up upgrade event handler
  httpServer.on('upgrade', (req, socket, head) => {
    // Skip Vite HMR WebSocket connections
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return
    }

    // Run the upgrade request through AsyncLocalStorage
    upgradeRequestStorage.run(
      [wsServer, req, socket, head],
      () => {
        // Create a fake response object for the Astro handler
        const fakeResponse = createFakeResponse()

        // Call the Astro dev handler
        astroDevHandler(req, fakeResponse)
      }
    )
  })

  // Clean up on server close
  httpServer.on('close', () => {
    wsServer.close()
  })
}

/**
 * Create a fake HTTP response object for upgrade handling
 */
function createFakeResponse(): import('node:http').ServerResponse {
  return {
    setHeader() {},
    write() {},
    writeHead() {},
    end() {},
    on() {},
    once() {},
    emit() { return false },
    removeListener() { return this },
    removeAllListeners() { return this },
    getMaxListeners() { return 0 },
    listenerCount() { return 0 },
    listeners() { return [] },
    rawListeners() { return [] },
    addListener() { return this },
    prependListener() { return this },
    prependOnceListener() { return this },
    headersSent: false,
    statusCode: 200,
    statusMessage: 'OK',
  } as any as import('node:http').ServerResponse
}