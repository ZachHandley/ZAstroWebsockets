import type * as ws from "ws"

type WebSocketInterface = globalThis.WebSocket

// WeakMap to store private WebSocket instances
const wsMap = new WeakMap<WebSocket, ws.WebSocket>()

// To keep the internals hidden
export const attacher: { attach: null | typeof attachImpl } = { attach: null }

export class WebSocket extends EventTarget implements WebSocketInterface {

    static readonly CONNECTING = 0 as const
    static readonly OPEN       = 1 as const
    static readonly CLOSING    = 2 as const
    static readonly CLOSED     = 3 as const

    get url() {
        const ws = wsMap.get(this)
        return ws?.url ?? ""
    }

    // ready state
    declare readonly CONNECTING: 0
    declare readonly OPEN      : 1
    declare readonly CLOSING   : 2
    declare readonly CLOSED    : 3

    get readyState() {
        const ws = wsMap.get(this)
        return ws?.readyState ?? this.CONNECTING
    }

    get bufferedAmount() {
        const ws = wsMap.get(this)
        return ws?.bufferedAmount ?? 0
    }

    // networking
    onopen : WebSocketInterface["onopen"]  = null
    onerror: WebSocketInterface["onerror"] = null
    onclose: WebSocketInterface["onclose"] = null

    get extensions() {
        const ws = wsMap.get(this)
        return ws?.extensions ?? ""
    }

    get protocol() {
        const ws = wsMap.get(this)
        return ws?.protocol ?? ""
    }

    close() {
        const ws = wsMap.get(this)
        if (ws) ws.close()
        else this.addEventListener("open", () => this.close(), { once: true })
    }

    // messaging
    onmessage : WebSocketInterface["onmessage"] = null

    get binaryType() {
        const ws = wsMap.get(this)
        return ws?.binaryType as "arraybuffer" | "blob" ?? "blob"
    }

    set binaryType(value: "arraybuffer" | "blob") {
        const ws = wsMap.get(this)
        if (ws) {
            // @ts-expect-error `"blob"` is supported by `ws`
            ws.binaryType = value
        } else {
            this.addEventListener("open", () => this.binaryType = value, { once: true })
        }
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        const ws = wsMap.get(this)
        if (data instanceof Blob) data.arrayBuffer().then(buffer => ws!.send(buffer))
        else ws!.send(data)
    }

    static {
        Object.assign(this.prototype, {
            CONNECTING: 0,
            OPEN      : 1,
            CLOSING   : 2,
            CLOSED    : 3
        })

        // Freeze the prototype and class to align the object shape with the spec
        Object.freeze(this.prototype)
        Object.freeze(this)

        attacher.attach = attachImpl
    }
}

function attachImpl(standard: WebSocket, ws: ws.WebSocket): void {
    // Use a WeakMap to store private WebSocket instances
    if (wsMap.has(standard)) {
        throw new Error("WebSocket already attached")
    }
    wsMap.set(standard, ws)
    init(standard, ws)
}

function init(standard: WebSocket, ws: ws.WebSocket) {
    // set the binary type to `"blob"` to align with the browser default
    // @ts-expect-error `"blob"` is supported by `ws`
    ws.binaryType = "blob"

    if (ws.readyState === ws.OPEN) {
        const event = new Event("open")
        standard.onopen?.(event)
        standard.dispatchEvent(event)
    }

    ws.on("open", function onOpen() {
        const event = new Event("open")
        standard.onopen?.(event)
        standard.dispatchEvent(event)
    })

    ws.on("message", function onMessage(data, isBinary) {
        const event = new MessageEvent("message", { data: isBinary ? data : data.toString(), })
        standard.onmessage?.(event)
        standard.dispatchEvent(event)
    })

    ws.on("error", function onError(error) {
        const event = new ErrorEvent(error, error.message)
        standard.onerror?.(event)
        standard.dispatchEvent(event)
    })

    ws.addEventListener("close", function onClose(ev) {
        const event = new (globalThis.CloseEvent ?? CloseEvent)("close", ev)
        standard.onclose?.(event)
        standard.dispatchEvent(event)
    })
}

export class ErrorEvent extends Event {
    constructor(readonly error: Error, readonly message: string) {
        super("error")
    }
}

export class CloseEvent extends Event implements globalThis.CloseEvent {
    readonly code: number
    readonly reason: string
    readonly wasClean: boolean

    constructor(type: string, eventInitDict: CloseEventInit) {
        super(type, eventInitDict)
        this.code = eventInitDict.code ?? 0
        this.reason = eventInitDict.reason ?? ""
        this.wasClean = eventInitDict.wasClean ?? false
    }
}

export function attach(standard: WebSocket, ws: ws.WebSocket): void {
    return attacher.attach?.(standard, ws)
}

interface CloseEventInit extends EventInit {
    code?: number
    reason?: string
    wasClean?: boolean
}

declare global {
    namespace App {
        interface Locals {
            isUpgradeRequest?: boolean
            upgradeWebSocket?: () => { socket: WebSocket, response: import("./response.js").UpgradeResponse }
        }
    }
}
