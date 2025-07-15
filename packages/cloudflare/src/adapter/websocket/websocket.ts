/**
 * Cloudflare WebSocket implementation
 */

type WebSocketInterface = globalThis.WebSocket

export interface WebSocketUpgrade {
  socket: WebSocket
  response: Response
}

export class WebSocket extends EventTarget implements WebSocketInterface {
  private _ws: CloudflareWebSocket | undefined
  private _readyState: number = WebSocket.CONNECTING
  private _binaryType: 'blob' | 'arraybuffer' = 'blob'
  private _url: string = ''
  private _protocol: string = ''
  private _extensions: string = ''
  private _bufferedAmount: number = 0

  static readonly CONNECTING = 0 as const
  static readonly OPEN       = 1 as const
  static readonly CLOSING    = 2 as const
  static readonly CLOSED     = 3 as const

  // Instance constants
  declare readonly CONNECTING: 0
  declare readonly OPEN      : 1
  declare readonly CLOSING   : 2
  declare readonly CLOSED    : 3

  // Event handlers
  onopen : WebSocketInterface["onopen"]  = null
  onerror: WebSocketInterface["onerror"] = null
  onclose: WebSocketInterface["onclose"] = null
  onmessage : WebSocketInterface["onmessage"] = null

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
    return this._bufferedAmount
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
    } else {
      // Close immediately if not attached
      this._readyState = WebSocket.CLOSED
      const event = new CloseEvent('close', { code: code || 1000, reason: reason || '', wasClean: true })
      this.onclose?.(event)
      this.dispatchEvent(event)
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this._readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }

    if (this._ws) {
      if (data instanceof Blob) {
        // Convert blob to array buffer for Cloudflare
        data.arrayBuffer().then(buffer => this._ws!.send(buffer))
      } else {
        this._ws.send(data)
      }
    }
  }

  static {
    Object.assign(this.prototype, {
      CONNECTING: 0,
      OPEN      : 1,
      CLOSING   : 2,
      CLOSED    : 3
    })

    // Freeze the prototype and class to align with the spec
    Object.freeze(this.prototype)
    Object.freeze(this)
  }
}

// WeakMap to store private Cloudflare WebSocket instances
const wsMap = new WeakMap<WebSocket, CloudflareWebSocket>()

export function attach(standard: WebSocket, cfWebSocket: CloudflareWebSocket): void {
  if (wsMap.has(standard)) {
    throw new Error('WebSocket already attached')
  }

  wsMap.set(standard, cfWebSocket)
  ;(standard as any)._ws = cfWebSocket
  ;(standard as any)._readyState = WebSocket.OPEN

  // Set up event forwarding
  cfWebSocket.addEventListener('message', (event) => {
    const messageEvent = new MessageEvent('message', { data: event.data })
    standard.onmessage?.(messageEvent)
    standard.dispatchEvent(messageEvent)
  })

  cfWebSocket.addEventListener('close', (event) => {
    ;(standard as any)._readyState = WebSocket.CLOSED
    const closeEvent = new CloseEvent('close', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    })
    standard.onclose?.(closeEvent)
    standard.dispatchEvent(closeEvent)
  })

  cfWebSocket.addEventListener('error', (event) => {
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

// Cloudflare WebSocket types
interface CloudflareWebSocket {
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'message', listener: (event: { data: any }) => void): void
