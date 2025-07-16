/**
 * WebSocket connection statistics and management for zastro-websockets-node
 * 
 * This module provides comprehensive connection tracking, statistics, and administrative
 * functions for managing WebSocket connections in production environments.
 */

import * as ws from "ws"
import type { WebSocket } from "./websocket.js"

/**
 * Metadata about a WebSocket connection
 */
export interface ConnectionMetadata {
  /** Unique connection identifier */
  id: string
  /** WebSocket instance */
  socket: WebSocket
  /** Underlying ws.WebSocket instance */
  wsSocket: ws.WebSocket
  /** Connection establishment timestamp */
  connectedAt: number
  /** Last activity timestamp */
  lastActivity: number
  /** Remote IP address */
  remoteAddress?: string
  /** User agent string */
  userAgent?: string
  /** Connection age in milliseconds */
  get age(): number
  /** Idle time in milliseconds since last activity */
  get idleTime(): number
  /** Current connection state */
  get state(): 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'
}

/**
 * Connection statistics summary
 */
export interface ConnectionStats {
  /** Total number of active connections */
  totalConnections: number
  /** Total connections established since startup */
  totalConnectionsEver: number
  /** Total connections closed since startup */
  totalConnectionsClosed: number
  /** Average connection age in milliseconds */
  averageAge: number
  /** Average idle time in milliseconds */
  averageIdleTime: number
  /** Connections by state */
  connectionsByState: {
    CONNECTING: number
    OPEN: number
    CLOSING: number
    CLOSED: number
  }
  /** Detailed connection information */
  connections: Array<{
    id: string
    age: number
    idleTime: number
    state: string
    remoteAddress?: string
    userAgent?: string
  }>
}

/**
 * WebSocket statistics and connection management
 */
class WebSocketStatsManager {
  private connections = new Map<string, ConnectionMetadata>()
  private connectionCounter = 0
  private totalConnectionsEver = 0
  private totalConnectionsClosed = 0
  private cleanupInterval?: NodeJS.Timeout
  private isShutdown = false

  constructor() {
    // Start periodic cleanup of stale connections
    this.startCleanupInterval()
  }

  /**
   * Register a new WebSocket connection for tracking
   */
  registerConnection(
    socket: WebSocket, 
    wsSocket: ws.WebSocket, 
    remoteAddress?: string, 
    userAgent?: string
  ): string {
    if (this.isShutdown) {
      throw new Error("WebSocketStats has been shutdown")
    }

    const id = `ws_${++this.connectionCounter}_${Date.now()}`
    this.totalConnectionsEver++

    const metadata: ConnectionMetadata = {
      id,
      socket,
      wsSocket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      remoteAddress,
      userAgent,
      get age() {
        return Date.now() - this.connectedAt
      },
      get idleTime() {
        return Date.now() - this.lastActivity
      },
      get state() {
        const readyState = wsSocket.readyState
        switch (readyState) {
          case ws.WebSocket.CONNECTING: return 'CONNECTING'
          case ws.WebSocket.OPEN: return 'OPEN'
          case ws.WebSocket.CLOSING: return 'CLOSING'
          case ws.WebSocket.CLOSED: return 'CLOSED'
          default: return 'CLOSED'
        }
      }
    }

    this.connections.set(id, metadata)

    // Set up event listeners to track activity and cleanup
    this.setupConnectionEventListeners(metadata)

    return id
  }

  /**
   * Set up event listeners for connection lifecycle tracking
   */
  private setupConnectionEventListeners(metadata: ConnectionMetadata): void {
    const { socket, wsSocket, id } = metadata

    // Track message activity
    const onMessage = () => {
      metadata.lastActivity = Date.now()
    }

    // Clean up on close
    const onClose = () => {
      this.unregisterConnection(id)
    }

    // Track error events
    const onError = () => {
      metadata.lastActivity = Date.now()
    }

    // Add listeners
    socket.addEventListener('message', onMessage)
    socket.addEventListener('close', onClose)
    socket.addEventListener('error', onError)

    // Also track on the underlying ws socket for completeness
    wsSocket.on('message', onMessage)
    wsSocket.on('close', onClose)
    wsSocket.on('error', onError)
  }

  /**
   * Unregister a connection (called automatically on close)
   */
  private unregisterConnection(id: string): void {
    if (this.connections.delete(id)) {
      this.totalConnectionsClosed++
    }
  }

  /**
   * Get the total number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size
  }

  /**
   * Get detailed connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const connections = Array.from(this.connections.values())
    const now = Date.now()

    // Calculate averages
    const totalAge = connections.reduce((sum, conn) => sum + conn.age, 0)
    const totalIdleTime = connections.reduce((sum, conn) => sum + conn.idleTime, 0)
    const averageAge = connections.length > 0 ? totalAge / connections.length : 0
    const averageIdleTime = connections.length > 0 ? totalIdleTime / connections.length : 0

    // Count by state
    const connectionsByState = {
      CONNECTING: 0,
      OPEN: 0,
      CLOSING: 0,
      CLOSED: 0
    }

    connections.forEach(conn => {
      connectionsByState[conn.state]++
    })

    return {
      totalConnections: this.connections.size,
      totalConnectionsEver: this.totalConnectionsEver,
      totalConnectionsClosed: this.totalConnectionsClosed,
      averageAge,
      averageIdleTime,
      connectionsByState,
      connections: connections.map(conn => ({
        id: conn.id,
        age: conn.age,
        idleTime: conn.idleTime,
        state: conn.state,
        remoteAddress: conn.remoteAddress,
        userAgent: conn.userAgent
      }))
    }
  }

  /**
   * Get set of active WebSocket instances
   */
  getActiveConnections(): Set<WebSocket> {
    const activeConnections = new Set<WebSocket>()
    const connections = Array.from(this.connections.values())
    for (const metadata of connections) {
      if (metadata.state === 'OPEN') {
        activeConnections.add(metadata.socket)
      }
    }
    return activeConnections
  }

  /**
   * Close all active connections
   */
  closeAllConnections(code?: number, reason?: string): void {
    const connections = Array.from(this.connections.values())
    connections.forEach(metadata => {
      try {
        if (metadata.state === 'OPEN' || metadata.state === 'CONNECTING') {
          // Use the underlying ws socket for close with code/reason
          if (code !== undefined || reason !== undefined) {
            metadata.wsSocket.close(code, reason)
          } else {
            metadata.socket.close()
          }
        }
      } catch (error) {
        console.warn(`Failed to close WebSocket connection ${metadata.id}:`, error)
      }
    })
  }

  /**
   * Clean up stale connections (already closed but not cleaned up)
   */
  cleanupStaleConnections(): number {
    let cleaned = 0
    const staleIds: string[] = []
    const entries = Array.from(this.connections.entries())

    for (const [id, metadata] of entries) {
      if (metadata.state === 'CLOSED') {
        staleIds.push(id)
      }
    }

    staleIds.forEach(id => {
      this.connections.delete(id)
      cleaned++
    })

    return cleaned
  }

  /**
   * Start periodic cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up stale connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 30000)
  }

  /**
   * Graceful shutdown - close all connections and cleanup
   */
  shutdown(): void {
    if (this.isShutdown) return

    this.isShutdown = true

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // Close all connections gracefully
    this.closeAllConnections(1001, 'Server shutting down')

    // Wait a moment for graceful closes, then force cleanup
    setTimeout(() => {
      this.connections.clear()
    }, 1000)
  }

  /**
   * Update activity timestamp for a connection
   */
  updateActivity(connectionId: string): void {
    const metadata = this.connections.get(connectionId)
    if (metadata) {
      metadata.lastActivity = Date.now()
    }
  }

  /**
   * Get connection metadata by ID
   */
  getConnection(connectionId: string): ConnectionMetadata | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys())
  }

  /**
   * Check if stats manager is shutdown
   */
  get isShutDown(): boolean {
    return this.isShutdown
  }
}

// Global singleton instance
const statsManager = new WebSocketStatsManager()

/**
 * WebSocket Statistics API
 * 
 * Provides connection tracking, statistics, and administrative functions
 * for WebSocket connections in Node.js environments.
 */
export const WebSocketStats = {
  /**
   * Get total number of active connections
   */
  getConnectionCount: () => statsManager.getConnectionCount(),

  /**
   * Get detailed connection statistics
   */
  getConnectionStats: () => statsManager.getConnectionStats(),

  /**
   * Get set of active WebSocket instances
   */
  getActiveConnections: () => statsManager.getActiveConnections(),

  /**
   * Close all active connections
   */
  closeAllConnections: (code?: number, reason?: string) => 
    statsManager.closeAllConnections(code, reason),

  /**
   * Graceful shutdown of connection manager
   */
  shutdown: () => statsManager.shutdown(),

  /**
   * Clean up stale connections
   */
  cleanupStaleConnections: () => statsManager.cleanupStaleConnections(),

  /**
   * Get connection metadata by ID
   */
  getConnection: (id: string) => statsManager.getConnection(id),

  /**
   * Get all connection IDs
   */
  getConnectionIds: () => statsManager.getConnectionIds(),

  /**
   * Check if stats manager is shutdown
   */
  get isShutDown() { return statsManager.isShutDown }
} as const

/**
 * Register a new WebSocket connection for tracking
 * This function should be called by the WebSocket attachment code
 */
export function registerConnection(
  socket: WebSocket, 
  wsSocket: ws.WebSocket,
  req?: import('node:http').IncomingMessage
): string {
  const remoteAddress = req?.socket.remoteAddress || req?.headers['x-forwarded-for'] as string
  const userAgent = req?.headers['user-agent']
  
  return statsManager.registerConnection(socket, wsSocket, remoteAddress, userAgent)
}

/**
 * Update activity for a connection
 */
export function updateConnectionActivity(connectionId: string): void {
  statsManager.updateActivity(connectionId)
}

/**
 * Utility function to log connection statistics
 */
export function logConnectionStats(): void {
  const stats = WebSocketStats.getConnectionStats()
  console.log(`[WebSocket Stats] Active: ${stats.totalConnections}, Total: ${stats.totalConnectionsEver}, Closed: ${stats.totalConnectionsClosed}`)
  
  if (stats.totalConnections > 0) {
    console.log(`[WebSocket Stats] Avg Age: ${Math.round(stats.averageAge / 1000)}s, Avg Idle: ${Math.round(stats.averageIdleTime / 1000)}s`)
    console.log(`[WebSocket Stats] By State - Open: ${stats.connectionsByState.OPEN}, Connecting: ${stats.connectionsByState.CONNECTING}, Closing: ${stats.connectionsByState.CLOSING}`)
  }
}

/**
 * Create middleware function for stats tracking
 */
export function createStatsMiddleware() {
  return {
    name: 'websocket-stats',
    hooks: {
      'astro:server:setup': ({ server }: { server: any }) => {
        // Log stats periodically
        const interval = setInterval(() => {
          logConnectionStats()
        }, 30000)

        // Clean up on server close
        if (server?.httpServer) {
          server.httpServer.on('close', () => {
            clearInterval(interval)
            statsManager.shutdown()
          })
        }
      }
    }
  }
}

// Handle process shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n[WebSocket Stats] Received SIGINT, shutting down gracefully...')
  statsManager.shutdown()
})

process.on('SIGTERM', () => {
  console.log('\n[WebSocket Stats] Received SIGTERM, shutting down gracefully...')
  statsManager.shutdown()
})

export default WebSocketStats