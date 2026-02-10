import { WebSocket, attach } from "./websocket.js";
const onRequest = async function cloudflareWebSocketMiddleware(context, next) {
  const { request, locals } = context;
  const isUpgradeRequest = request.headers.get("upgrade") === "websocket" && request.headers.get("connection")?.toLowerCase().includes("upgrade");
  locals.isUpgradeRequest = isUpgradeRequest;
  locals.upgradeWebSocket = () => {
    if (!isUpgradeRequest) {
      throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.");
    }
    const webSocketPair = new WebSocketPair();
    const [client, server] = [webSocketPair[0], webSocketPair[1]];
    server.accept();
    const socket = new WebSocket(request.url);
    attach(socket, server);
    const response = new Response(null, {
      status: 101,
      statusText: "Switching Protocols",
      webSocket: client
    });
    return { socket, response };
  };
  return next();
};
export {
  onRequest
};
