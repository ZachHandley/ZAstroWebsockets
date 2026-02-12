import { WebSocket, attach } from "./websocket.js";
function createWebSocketHandler(app) {
  return async function handleWebSocket(request, env, ctx) {
    const upgradeHeader = request.headers.get("upgrade");
    const connectionHeader = request.headers.get("connection");
    if (upgradeHeader !== "websocket" || !connectionHeader?.toLowerCase().includes("upgrade")) {
      return app.render(request, { locals: { isUpgradeRequest: false } });
    }
    const webSocketPair = new WebSocketPair();
    const [client, server] = [webSocketPair[0], webSocketPair[1]];
    server.accept();
    const response = await app.render(request, {
      locals: {
        isUpgradeRequest: true,
        upgradeWebSocket() {
          const socket = new WebSocket(request.url);
          attach(socket, server);
          const upgradeResponse = new Response(null, {
            status: 101,
            statusText: "Switching Protocols",
            webSocket: client
          });
          return { socket, response: upgradeResponse };
        },
        runtime: {
          env,
          cf: request.cf,
          ctx,
          caches: globalThis.caches,
          waitUntil: (promise) => ctx.waitUntil(promise)
        }
      }
    });
    if (response.status === 101) {
      return new Response(null, {
        status: 101,
        statusText: "Switching Protocols",
        webSocket: client
      });
    }
    return response;
  };
}
import { WebSocket as WebSocket2, attach as attach2 } from "./websocket.js";
export {
  WebSocket2 as WebSocket,
  attach2 as attach,
  createWebSocketHandler
};
