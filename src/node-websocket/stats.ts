import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

// Basic stats tracking
class WebSocketStatsManager {
  private connections = new Map<string, any>()
  private connectionCounter = 0
  private lifetimeConnections = 0

  registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string {
    const id = `ws_${++this.connectionCounter}_${Date.now()}`
    this.connections.set(id, { socket, wsSocket })
    this.lifetimeConnections++

    // Remove on close
    wsSocket.on("close", () => {
      this.connections.delete(id)
    })

    return id
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  getConnectionStats(): { totalConnections: number; totalConnectionsEver: number } {
    return {
      totalConnections: this.connections.size,
      totalConnectionsEver: this.lifetimeConnections
    }
  }
}

const statsManager = new WebSocketStatsManager()

export const WebSocketStats = {
  getConnectionCount: () => statsManager.getConnectionCount(),
  getConnectionStats: () => statsManager.getConnectionStats(),
  shutdown: () => {}
}

export function registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string {
  return statsManager.registerConnection(socket, wsSocket)
}
