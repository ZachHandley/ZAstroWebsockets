const onRequest = async function websocketDevMiddleware(context, next) {
  const { request, locals } = context;
  const isUpgradeRequest = request.headers.get("upgrade") === "websocket";
  locals.isUpgradeRequest = isUpgradeRequest;
  locals.upgradeWebSocket = () => {
    throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.");
  };
  return next();
};
export {
  onRequest
};
