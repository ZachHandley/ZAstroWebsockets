import { AsyncLocalStorage } from "node:async_hooks";
import * as ws from "ws";
import { UpgradeResponse, writeResponseToSocket } from "./response.js";
import { WebSocket } from "./websocket.js";
import { attach as _attach } from "./attach.js";
const upgradeRequestStorage = (
  // @ts-expect-error
  globalThis.__upgradeRequestStorage ??= new AsyncLocalStorage()
);
const responseToSocketMap = (
  // @ts-expect-error
  globalThis.__responseToSocketMap ??= /* @__PURE__ */ new WeakMap()
);
globalThis.__UpgradeResponse = UpgradeResponse;
function newUpgradeResponse() {
  return new globalThis.__UpgradeResponse();
}
globalThis.__WebSocket = WebSocket;
function newWebSocket() {
  return new globalThis.__WebSocket();
}
globalThis.__attach = _attach;
function attach(...args) {
  return globalThis.__attach(...args);
}
const onRequest = async function websocketDevMiddleware(context, next) {
  const upgradeRequest = upgradeRequestStorage.getStore();
  if (upgradeRequest === void 0) {
    if (!context.locals.isUpgradeRequest) {
      Object.assign(context.locals, {
        isUpgradeRequest: false,
        upgradeWebSocket() {
          throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.");
        }
      });
    }
    return next();
  }
  let response;
  let error;
  try {
    response = await next();
  } catch (e) {
    error = e;
  }
  if (response) {
    if (response instanceof UpgradeResponse) {
      const standardWebSocket = responseToSocketMap.get(response);
      const [wsServer, req, socket, head] = upgradeRequest;
      wsServer.handleUpgrade(req, socket, head, (ws2) => attach(standardWebSocket, ws2));
    } else {
      const socket = upgradeRequest[2];
      await writeResponseToSocket(socket, response);
    }
    return response;
  }
  await writeResponseToSocket(upgradeRequest[2], new Response(null, { status: 500 }));
  if (error && error instanceof Error) throw error;
  throw new Error("Unknown error", { cause: error });
};
const devLocals = {
  isUpgradeRequest: true,
  upgradeWebSocket() {
    const response = newUpgradeResponse();
    const socket = newWebSocket();
    responseToSocketMap.set(response, socket);
    return { socket, response };
  }
};
function handleUpgradeRequests(viteDevServer) {
  const astroDevHandler = viteDevServer.middlewares.stack.find((stackItem) => "name" in stackItem.handle && stackItem.handle.name === "astroDevHandler").handle;
  const wsServer = new ws.WebSocketServer({ noServer: true });
  const httpServer = viteDevServer.httpServer;
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.headers["sec-websocket-protocol"] === "vite-hmr") return;
    req[Symbol.for("astro.locals")] = devLocals;
    upgradeRequestStorage.run([wsServer, req, socket, head], astroDevHandler, req, fakeResponse);
  });
}
const fakeResponse = {
  setHeader() {
  },
  write() {
  },
  writeHead() {
  },
  end() {
  },
  on() {
  }
};
export {
  handleUpgradeRequests,
  onRequest
};
