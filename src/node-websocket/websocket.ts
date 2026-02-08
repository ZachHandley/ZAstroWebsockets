import type * as ws from "ws"
import { attacher } from "./attach.js"

type WebSocketInterface = globalThis.WebSocket

export class WebSocket extends EventTarget implements WebSocketInterface {
    // Use private field like the original patch
    #ws: ws.WebSocket | undefined

    static readonly CONNECTING = 0 as const
    static readonly OPEN       = 1 as const
    static readonly CLOSING    = 2 as const
    static readonly CLOSED     = 3 as const

    get url() {
        return this.#ws?.url ?? ""
    }

    // ready state constants
    declare readonly CONNECTING: 0
    declare readonly OPEN      : 1
    declare readonly CLOSING   : 2
    declare readonly CLOSED    : 3

    get readyState() {
        return this.#ws?.readyState ?? this.CONNECTING
    }

    get bufferedAmount() {
        return this.#ws?.bufferedAmount ?? 0
    }

    // networking event handlers
    onopen : WebSocketInterface["onopen"]  = null
    onerror: WebSocketInterface["onerror"] = null
    onclose: WebSocketInterface["onclose"] = null

    get extensions() {
        return this.#ws?.extensions ?? ""
    }

    get protocol() {
        return this.#ws?.protocol ?? ""
    }

    close() {
        if (this.#ws) this.#ws.close()
        else this.addEventListener("open", () => this.close(), { once: true })
    }

    // messaging
    onmessage : WebSocketInterface["onmessage"] = null

    get binaryType() {
        return (this.#ws?.binaryType as "arraybuffer" | "blob") ?? "blob"
    }

    set binaryType(value: "arraybuffer" | "blob") {
        // There's nothing stopping the user from setting the binary type
        // to either `"nodebuffer"` or `"fragments"`, just type errors.
        // Deviating from the standard `WebSocket` interface to properly
        // support it, however, will come at the cost of portability.
        if (this.#ws) {
            // @ts-expect-error `"blob"` is supported by `ws`
            this.#ws.binaryType = value
        } else {
            this.addEventListener("open", () => this.binaryType = value, { once: true })
        }
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (data instanceof Blob) data.arrayBuffer().then(buffer => this.#ws!.send(buffer))
        else this.#ws!.send(data)
    }

    static {
        // Set instance constants on prototype
        Object.assign(this.prototype, {
            CONNECTING: 0,
            OPEN      : 1,
            CLOSING   : 2,
            CLOSED    : 3
        })

        // Freeze the prototype and class to align the object shape with the spec
        Object.freeze(this.prototype)
        Object.freeze(this)

        // CRITICAL: Set the attacher from attach.ts so that serve-websocket.ts
        // can use it to connect the real ws.WebSocket to this wrapper
        attacher.attach = (standard, ws) => {
            if (standard.#ws) {
                throw new Error("WebSocket already attached")
            }
            standard.#ws = ws
            init(standard, ws)
            return standard
        }
    }
}

function init(standard: WebSocket, ws: ws.WebSocket) {

    // set the binary type to `"blob"` to align with the browser default
    // @ts-expect-error `"blob"` is supported by `ws`
    // https://github.com/websockets/ws/blob/8.18.0/lib/constants.js#L6
    ws.binaryType = "blob"

    if (ws.readyState === ws.OPEN) {
        const event = new Event("open")
        standard.onopen?.(event)
        standard.dispatchEvent(event)
    }

    // The functions are not using the arrow syntax
    // to allow the name to appear in stacktraces.
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
    // Using `.addEventListener()` here instead of `.on()`,
    // because the `wasClean` field is determined by ws's
    // internals.
    ws.addEventListener("close", function onClose(ev) {
        /**
         * The `CloseEvent` is available globally
         * starting with Node.js 23. Use it if available.
         * https://nodejs.org/api/globals.html#:~:text=The%20CloseEvent%20class
         */
        const event = new (globalThis.CloseEvent ?? CloseEvent)("close", ev)
        standard.onclose?.(event)
        standard.dispatchEvent(event)
    })
}

// `ErrorEvent` does not exist in browsers. The "error"
// event is an instance of `Error`, but on the server,
// there is more information available about the exact
// error, which is exposed via this subclass.
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
