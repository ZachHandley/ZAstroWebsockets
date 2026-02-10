class WebSocketStatsManager {
  connections = /* @__PURE__ */ new Map();
  connectionCounter = 0;
  lifetimeConnections = 0;
  registerConnection(socket, wsSocket) {
    const id = `ws_${++this.connectionCounter}_${Date.now()}`;
    this.connections.set(id, { socket, wsSocket });
    this.lifetimeConnections++;
    wsSocket.on("close", () => {
      this.connections.delete(id);
    });
    return id;
  }
  getConnectionCount() {
    return this.connections.size;
  }
  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      totalConnectionsEver: this.lifetimeConnections
    };
  }
}
const statsManager = new WebSocketStatsManager();
const WebSocketStats = {
  getConnectionCount: () => statsManager.getConnectionCount(),
  getConnectionStats: () => statsManager.getConnectionStats(),
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
