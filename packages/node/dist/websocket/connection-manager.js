class ConnectionManager {
  connections = /* @__PURE__ */ new Map();
  registerConnection(socket, wsSocket) {
    const id = `conn_${Date.now()}`;
    this.connections.set(id, { socket, wsSocket });
    return id;
  }
}
const ConnectionManagerAPI = {
  getInstance: () => new ConnectionManager(),
  getStats: () => ({ totalConnections: 0 })
};
export {
  ConnectionManager,
  ConnectionManagerAPI
};
