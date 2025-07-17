class WebSocketStatsManager {
  connections = /* @__PURE__ */ new Map();
  connectionCounter = 0;
  registerConnection(socket, wsSocket) {
    const id = `ws_${++this.connectionCounter}_${Date.now()}`;
    this.connections.set(id, { socket, wsSocket });
    return id;
  }
  getConnectionCount() {
    return this.connections.size;
  }
}
const statsManager = new WebSocketStatsManager();
const WebSocketStats = {
  getConnectionCount: () => statsManager.getConnectionCount(),
  getConnectionStats: () => ({ totalConnections: statsManager.getConnectionCount() }),
  shutdown: () => {
  }
};
function registerConnection(socket, wsSocket) {
  return statsManager.registerConnection(socket, wsSocket);
}
export {
  WebSocketStats,
  registerConnection
};
