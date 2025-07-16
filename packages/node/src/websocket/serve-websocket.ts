import * as ws from "ws"
import { NodeApp } from "astro/app/node"
import { WebSocket } from "./websocket.js"
import { attach } from "./attach.js"
import { UpgradeResponse, writeResponseToSocket } from "./response.js"

export type UpgradeHandler =
    import("node:http").Server["on"] extends
        (event: "upgrade", callback: infer UpgradeHandler) => unknown
            ? UpgradeHandler
            : never

export function createWebsocketHandler(app: NodeApp): UpgradeHandler {
    /**
     * The websocket instance is created as soon as
     * `locals.upgradeWebSocket()` is called. It gets
     * attached to an actual connection once the app
     * code returns a response.
     *
     * This map is used to keep track of the
     * responses' associated websocket instance.
     */
    const responseToSocketMap = new WeakMap<Response, WebSocket>
    const server = new ws.WebSocketServer({ noServer: true })

    return async (req, socket, head) => {
        const response = await app.render(NodeApp.createRequest(req), {
            addCookieHeader: true,
            locals: {
                isUpgradeRequest: true,
                upgradeWebSocket() {
                    const socket = new WebSocket
                    const response = new UpgradeResponse
                    responseToSocketMap.set(response, socket)
                    return { socket, response }
                }
            }
        })

        if (response instanceof UpgradeResponse) {
            const websocket = responseToSocketMap.get(response)!
            server.handleUpgrade(req, socket, head, ws => attach(websocket, ws, req))
        } else {
            await writeResponseToSocket(socket, response)
        }
    }
}