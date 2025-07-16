/**
 * TypeScript definitions for zastro-websockets
 */

export interface WebSocketEventMap {
  "close": CloseEvent
  "error": Event
  "message": MessageEvent
  "open": Event
}

export interface ZastroWebSocket extends EventTarget {
  /**
   * Returns a string that indicates how binary data from the WebSocket object is exposed to scripts:
   * - "blob": Binary data is exposed as Blob objects
   * - "arraybuffer": Binary data is exposed as ArrayBuffer objects
   */
  binaryType: "blob" | "arraybuffer"
  
  /**
   * Returns the number of bytes of application data (UTF-8 text and binary data) that have been queued using send() but not yet been transmitted to the network.
   */
  readonly bufferedAmount: number
  
  /**
   * Returns the extensions selected by the server.
   */
  readonly extensions: string
  
  /**
   * Returns the subprotocol selected by the server.
   */
  readonly protocol: string
  
  /**
   * Returns the state of the WebSocket object's connection.
   */
  readonly readyState: number
  
  /**
   * Returns the URL that was used to establish the WebSocket connection.
   */
  readonly url: string
  
  /**
   * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
   */
  close(code?: number, reason?: string): void
  
  /**
   * Transmits data using the WebSocket connection.
   */
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void
  
  readonly CLOSED: 3
  readonly CLOSING: 2
  readonly CONNECTING: 0
  readonly OPEN: 1
  
  addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: ZastroWebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
  removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: ZastroWebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
  
  onclose: ((this: ZastroWebSocket, ev: CloseEvent) => any) | null
  onerror: ((this: ZastroWebSocket, ev: Event) => any) | null
  onmessage: ((this: ZastroWebSocket, ev: MessageEvent) => any) | null
  onopen: ((this: ZastroWebSocket, ev: Event) => any) | null
}

/**
 * WebSocket upgrade response with status 101
 */
export interface UpgradeResponse extends Response {
  readonly status: 101
}

/**
 * WebSocket upgrade result
 */
export interface WebSocketUpgrade {
  /**
   * The WebSocket instance for bidirectional communication
   */
  socket: ZastroWebSocket
  
  /**
   * The HTTP response to return (status 101 Switching Protocols)
   */
  response: Response
}

/**
 * Base locals interface that all adapters extend
 */
export interface BaseLocals {
  /**
   * Whether the current request wants the connection to be upgraded to a WebSocket
   */
  isUpgradeRequest: boolean
  
  /**
   * Upgrade an incoming HTTP request to a bidirectional WebSocket connection.
   * 
   * Returns a pair of WebSocket and Response instances. The request must be 
   * responded to with the provided response for the WebSocket to open and 
   * start receiving messages.
   * 
   * @example
   * ```ts
   * export const GET: APIRoute = (ctx) => {
   *   if (ctx.locals.isUpgradeRequest) {
   *     const { response, socket } = ctx.locals.upgradeWebSocket()
   *     socket.onmessage = event => {
   *       if (event.data === "ping") {
   *         socket.send("pong")
   *       }
   *     }
   *     return response
   *   }
   *   return new Response("Upgrade required", { status: 426 })
   * }
   * ```
   * 
   * @throws {Error} If the request is not an upgrade request
   */
  upgradeWebSocket(): WebSocketUpgrade
}

/**
 * Node.js specific locals
 */
export interface NodeLocals extends BaseLocals {
  // Node.js doesn't add any additional properties
}

/**
 * Cloudflare specific locals
 */
export interface CloudflareLocals extends BaseLocals {
  /**
   * Cloudflare runtime context (bindings, environment, etc.)
   */
  runtime?: {
    env: any
    cf: any
    ctx: any
    caches: any
    waitUntil: (promise: Promise<any>) => void
  }
}


/**
 * Options for WebSocket integration
 */
export interface ZastroWebSocketOptions {
  /**
   * Adapters to patch with WebSocket support
   * 'auto' will attempt to detect installed adapters automatically
   */
  adapters?: ('node' | 'cloudflare')[] | 'auto'
  
  /**
   * Whether to auto-patch detected adapters on installation
   * @default true
   */
  autoPatch?: boolean
  
  /**
   * Whether to enable verbose logging during patch operations
   * @default false
   */
  verbose?: boolean
}

/**
 * Adapter-specific options
 */
export interface NodeAdapterOptions {
  mode?: 'middleware' | 'standalone'
  host?: string | boolean
}

export interface CloudflareAdapterOptions {
  platformProxy?: {
    enabled?: boolean
    configPath?: string
    experimentalJsonConfig?: boolean
  }
  imageService?: 'passthrough' | 'cloudflare'
  wasmModuleImports?: boolean
  runtime?: {
    mode?: 'local' | 'remote'
    type?: 'pages' | 'workers'
    bindings?: Record<string, any>
  }
}


// Augment Astro's global namespace
declare global {
  namespace App {
    interface Locals extends BaseLocals {}
  }
}

// Re-export our WebSocket interface as WebSocket for compatibility
export type WebSocket = ZastroWebSocket

/**
 * WebSocket connection statistics and management
 */
export interface WebSocketStatsAPI {
  /**
   * Get total number of active connections
   */
  getConnectionCount(): number

  /**
   * Get detailed connection statistics
   */
  getConnectionStats(): {
    totalConnections: number
    totalConnectionsEver: number
    totalConnectionsClosed: number
    averageAge: number
    averageIdleTime: number
    connectionsByState: {
      CONNECTING: number
      OPEN: number
      CLOSING: number
      CLOSED: number
    }
    connections: Array<{
      id: string
      age: number
      idleTime: number
      state: string
      remoteAddress?: string
      userAgent?: string
    }>
  }

  /**
   * Get set of active WebSocket instances
   */
  getActiveConnections(): Set<ZastroWebSocket>

  /**
   * Close all active connections
   */
  closeAllConnections(code?: number, reason?: string): void

  /**
   * Graceful shutdown of connection manager
   */
  shutdown(): void

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections(): number

  /**
   * Check if stats manager is shutdown
   */
  readonly isShutDown: boolean
}