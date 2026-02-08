/**
 * Cloudflare WebSocket implementation
 */

export interface WebSocketUpgrade {
  socket: WebSocket
  response: Response
}

// CloudFlare WebSocket implementation matches original patch structure
export class WebSocket extends EventTarget {
  static readonly CONNECTING = 0 as const
  static readonly OPEN       = 1 as const
  static readonly CLOSING    = 2 as const
  static readonly CLOSED     = 3 as const

  // CloudFlare doesn't use private fields - use simple approach
  private _readyState: number = WebSocket.CONNECTING
  private _binaryType: 'blob' | 'arraybuffer' = 'blob'
  private _url: string = ''
  private _protocol: string = ''
  private _extensions: string = ''
  private _ws: CloudflareWebSocket | undefined

  // Instance constants
  readonly CONNECTING: 0 = 0
  readonly OPEN: 1 = 1
  readonly CLOSING: 2 = 2
  readonly CLOSED: 3 = 3

  // Event handlers
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url?: string) {
    super()
    this._url = url || ''
  }

  get url() {
    return this._url
  }

  get readyState() {
    return this._readyState
  }

  get bufferedAmount() {
    return 0 // CloudFlare doesn't track buffered amount
  }

  get extensions() {
    return this._extensions
  }

  get protocol() {
    return this._protocol
  }

  get binaryType() {
    return this._binaryType
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this._binaryType = value
  }

  close(code?: number, reason?: string) {
    if (this._readyState === WebSocket.CLOSED || this._readyState === WebSocket.CLOSING) {
      return
    }

    this._readyState = WebSocket.CLOSING
    if (this._ws) {
      this._ws.close(code, reason)
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this._readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    if (this._ws) {
      this._ws.send(data as any)
    }
  }
}

// WeakMap to store private Cloudflare WebSocket instances
const wsMap = new WeakMap<WebSocket, CloudflareWebSocket>()

export function attach(standard: WebSocket, cfWebSocket: CloudflareWebSocket): void {
  if (wsMap.has(standard)) {
    throw new Error('WebSocket already attached')
  }

  wsMap.set(standard, cfWebSocket)

  // Set private properties
  Object.defineProperty(standard, '_ws', { value: cfWebSocket, writable: true })
  Object.defineProperty(standard, '_readyState', { value: WebSocket.OPEN, writable: true })

  // Set up event forwarding
  cfWebSocket.addEventListener('message', (event: { data: any }) => {
    const messageEvent = new MessageEvent('message', { data: event.data })
    standard.onmessage?.(messageEvent)
    standard.dispatchEvent(messageEvent)
  })

  cfWebSocket.addEventListener('close', (event: { code: number; reason: string; wasClean: boolean }) => {
    Object.assign(standard, { _readyState: WebSocket.CLOSED })
    const closeEvent = new CloseEvent('close', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    })
    standard.onclose?.(closeEvent)
    standard.dispatchEvent(closeEvent)
  })

  cfWebSocket.addEventListener('error', (_event: any) => {
    const errorEvent = new ErrorEvent('error', { message: 'WebSocket error' })
    standard.onerror?.(errorEvent)
    standard.dispatchEvent(errorEvent)
  })

  // Dispatch open event
  const openEvent = new Event('open')
  standard.onopen?.(openEvent)
  standard.dispatchEvent(openEvent)
}

export class ErrorEvent extends Event {
  constructor(type: string, init?: { message?: string }) {
    super(type)
    this.message = init?.message || ''
  }

  readonly message: string
}

export class CloseEvent extends Event implements globalThis.CloseEvent {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean

  constructor(type: string, eventInitDict?: CloseEventInit) {
    super(type, eventInitDict)
    this.code = eventInitDict?.code ?? 0
    this.reason = eventInitDict?.reason ?? ''
    this.wasClean = eventInitDict?.wasClean ?? false
  }
}

interface CloseEventInit extends EventInit {
  code?: number
  reason?: string
  wasClean?: boolean
}

// Cloudflare WebSocket types - use the types from @cloudflare/workers-types
interface CloudflareWebSocket {
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'message', listener: (event: { data: any }) => void): void
  addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
  addEventListener(type: 'error', listener: (event: any) => void): void
  addEventListener(type: 'open', listener: (event: any) => void): void
  removeEventListener(type: string, listener: any): void
  readonly readyState: number
  readonly url: string
  accept(): void
}
