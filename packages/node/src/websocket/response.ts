import { pipeline } from "node:stream/promises"

export class UpgradeResponse extends Response {
    readonly status = 101

    constructor() {
        // Use status 200 for Response constructor, but we'll handle 101 manually
        super(null, {
            status: 200,
            statusText: "Switching Protocols",
            headers: {
                "Upgrade": "websocket",
                "Connection": "Upgrade"
            }
        })
        
        // Override the status property to 101 for WebSocket upgrade
        Object.defineProperty(this, 'status', {
            value: 101,
            writable: false,
            enumerable: true,
            configurable: false
        })
    }
}

export async function writeResponseToSocket(socket: import("node:stream").Duplex, response: Response) {
    let head = `HTTP/1.1 ${response.status}`
    if (response.statusText) head += ` ${response.statusText}`
    head += `\r\n`

    for (const [name, value] of response.headers) {
        head += `${name}: ${value}\r\n`
    }

    socket.write(head + "\r\n")

    if (response.body) {
        await pipeline(response.clone().body!, socket)
    }
}