import * as ws from "ws";
import { NodeApp } from "astro/app/node";
import { WebSocket } from "./websocket.js";
import { attach } from "./attach.js";
import { UpgradeResponse, writeResponseToSocket } from "./response.js";
import { registerConnection } from "./stats.js";
function createWebsocketHandler(app) {
  const responseToSocketMap = /* @__PURE__ */ new WeakMap();
  const server = new ws.WebSocketServer({ noServer: true });
  return async (req, socket, head) => {
    const response = await app.render(NodeApp.createRequest(req), {
      addCookieHeader: true,
      locals: {
        isUpgradeRequest: true,
        upgradeWebSocket() {
          const websocket = new WebSocket();
          const response2 = new UpgradeResponse();
          responseToSocketMap.set(response2, websocket);
          return { socket: websocket, response: response2 };
        }
      }
    });
    if (response instanceof UpgradeResponse) {
      const websocket = responseToSocketMap.get(response);
      server.handleUpgrade(req, socket, head, (wsSocket) => {
        registerConnection(websocket, wsSocket);
        attach(websocket, wsSocket);
      });
    } else {
      await writeResponseToSocket(socket, response);
    }
  };
}
export {
  createWebsocketHandler
};
