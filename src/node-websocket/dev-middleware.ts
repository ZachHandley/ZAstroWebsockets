import { AsyncLocalStorage } from "node:async_hooks"
import type { APIContext, AstroIntegration, MiddlewareNext } from "astro"
import * as ws from "ws"
import { UpgradeResponse, writeResponseToSocket } from "./response.js"
import { WebSocket } from "./websocket.js"
import { attach as _attach } from "./attach.js"
import type { UpgradeHandler } from "./serve-websocket.js"

export type ViteDevServer =
    Parameters<
        NonNullable<
            AstroIntegration["hooks"]["astro:server:setup"]
        >
    >[0]["server"]

type AstroDevHandler = (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
) => void

/**
 * This is a storage for the upgrade request.
 *
 * When the dev http server receives an upgrade request,
 * the required objects are put into the storage, and
 * when an upgrade response is returned, the objects are
 * retrieved from it to perform the upgrade.
 *
 * To prevent issues around compilation and module
 * duplication in the dev server, the instance is
 * assigned onto globalThis to keep it singular.
 */
const upgradeRequestStorage: AsyncLocalStorage<[
    wsServer: ws.WebSocketServer,
    ...Parameters<UpgradeHandler>
]> =
    // @ts-expect-error
    globalThis.__upgradeRequestStorage ??= new AsyncLocalStorage

const responseToSocketMap: WeakMap<Response, WebSocket> =
    // @ts-expect-error
    globalThis.__responseToSocketMap ??= new WeakMap


/**
 * Similar to how `upgradeRequestStorage` and `responseToSocketMap`
 * are kept singular.
 *
 * Except here the latest versions are kept instead of the first
 * versions because of how the astro config module is loaded.
 *
 * The astro config module is loaded by a temporary vite instance,
 * which does not read `tsconfig.json`. As a result, all typescript
 * code is compiled with `useDefineForClassFields: false`, which
 * prevents `UpgradeResponse` from overriding the status field of
 * `Response`.
 *
 * As a workaround, the current `UpgradeResponse` class is put onto
 * `globalThis`. This replaces the `UpgradeResponse` class being
 * used by the locals with the functional version that is compiled
 * later, during the compilation of the project's middleware chain.
 */
// @ts-expect-error
globalThis.__UpgradeResponse = UpgradeResponse

function newUpgradeResponse(): UpgradeResponse {
    // @ts-expect-error
    return new globalThis.__UpgradeResponse
}

// @ts-expect-error
globalThis.__WebSocket = WebSocket

function newWebSocket(): WebSocket {
    // @ts-expect-error
    return new globalThis.__WebSocket
}

// @ts-expect-error
globalThis.__attach = _attach

function attach(...args: Parameters<typeof _attach>): void {
    // @ts-expect-error
    return globalThis.__attach(...args)
}

/**
 * This dev-only middleware is responsible for all requests
 * that have been made as a result of an upgrade request.
 *
 * It checks whether the request is running within the context
 * of an `upgradeRequestStorage`, which are created below in
 * `hookIntoViteDevServer()`, and only runs if it is.
 */
export const onRequest = async function websocketDevMiddleware(context: APIContext, next: MiddlewareNext) {
    const upgradeRequest = upgradeRequestStorage.getStore()

    if (upgradeRequest === undefined) {
        // In production, the upgrade handler sets isUpgradeRequest = true directly
        // via locals passed to app.render(). Don't overwrite those.
        if (!context.locals.isUpgradeRequest) {
            Object.assign(context.locals, {
                isUpgradeRequest: false,
                upgradeWebSocket() {
                    throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.")
                }
            })
        }
        return next()
    }

    let response: Response | undefined
    let error: unknown

    try {
        response = await next()
    } catch (e) {
        error = e
    }


    if (response) {
        if (response instanceof UpgradeResponse) {
            const standardWebSocket = responseToSocketMap.get(response)!
            const [ wsServer, req, socket, head ] = upgradeRequest
            wsServer.handleUpgrade(req, socket, head, ws => attach(standardWebSocket, ws))
        } else {
            /**
             * If there was an upgrade request, but the response
             * did not accept the upgrade, the response still
             * needs to be manually handled.
             */
            const socket = upgradeRequest[2]
            await writeResponseToSocket(socket, response)
        }
        /**
         * Since the astroDevHandler has been given a fake
         * response object to write the response into, the
         * response returned here will not result in any
         * network I/O. It is effectively just logging the
         * status code of the response to the terminal.
         */
        return response
    }

    await writeResponseToSocket(upgradeRequest[2], new Response(null, { status: 500 }))

    if (error && error instanceof Error) throw error

    throw new Error("Unknown error", { cause: error })
}

const devLocals = {
    isUpgradeRequest: true,
    upgradeWebSocket() {
        const response = newUpgradeResponse()
        const socket = newWebSocket()
        responseToSocketMap.set(response, socket)
        return { socket, response }
    }
}

export function handleUpgradeRequests(viteDevServer: ViteDevServer) {

    const astroDevHandler =
        viteDevServer.middlewares.stack
        .find(stackItem => "name" in stackItem.handle && stackItem.handle.name === "astroDevHandler")!
        .handle as AstroDevHandler

    const wsServer = new ws.WebSocketServer({ noServer: true })

    // vite dev server may be http2 or may not exist if it runs in middleware mode
    // neither of these cases are supported by the current implementation
    const httpServer = viteDevServer.httpServer as import("node:http").Server

    httpServer.on("upgrade", (req, socket, head) => {
        if (req.headers["sec-websocket-protocol"] === "vite-hmr") return
        (req as any)[Symbol.for("astro.locals")] = devLocals
        upgradeRequestStorage.run([ wsServer, req, socket, head ], astroDevHandler, req, fakeResponse)
    })
}

const fakeResponse = {
    setHeader() {},
    write() {},
    writeHead() {},
    end() {},
    on() {},
} as any as import("node:http").ServerResponse
