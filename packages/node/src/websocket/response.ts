import { pipeline } from "node:stream/promises"

export class UpgradeResponse extends Response {
    readonly status = 101

    constructor() {
        super(null, {
            status: 101,
            statusText: "Switching Protocols",
            headers: {
                "Upgrade": "websocket",
                "Connection": "Upgrade"
            }
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