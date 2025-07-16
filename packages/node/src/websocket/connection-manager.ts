/**
 * Advanced WebSocket Connection Manager for zastro-websockets-node
 * 
 * This module provides comprehensive connection lifecycle management, background services,
 * and advanced features beyond the basic WebSocketStats API. It includes connection pooling,
 * rate limiting, health monitoring, and graceful shutdown coordination.
 */

import * as ws from "ws"
import { EventEmitter } from "events"
import type { WebSocket } from "./websocket.js"
import { WebSocketStats, registerConnection, type ConnectionMetadata } from "./stats.js"

/**
 * Connection manager configuration options
 */
export interface ConnectionManagerConfig {
  /** Maximum number of concurrent connections (default: 1000) */
  maxConnections?: number
  /** Maximum connections per IP address (default: 10) */
  maxConnectionsPerIP?: number
  /** Connection idle timeout in milliseconds (default: 300000 = 5 minutes) */
  idleTimeout?: number
  /** Rate limiting window in milliseconds (default: 60000 = 1 minute) */
  rateLimitWindow?: number
  /** Maximum connections per IP in rate limit window (default: 5) */
  rateLimitMaxConnections?: number
  /** Health check interval in milliseconds (default: 30000 = 30 seconds) */
  healthCheckInterval?: number
  /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
  cleanupInterval?: number
  /** Connection upgrade timeout in milliseconds (default: 5000) */
  upgradeTimeout?: number
  /** Enable connection pooling (default: true) */
  enablePooling?: boolean
  /** Enable rate limiting (default: true) */
  enableRateLimit?: boolean
  /** Enable health monitoring (default: true) */
  enableHealthMonitoring?: boolean
  /** Custom cleanup policy function */
  customCleanupPolicy?: (connection: ManagedConnection) => boolean
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Minimum pool size (default: 0) */
  minSize?: number
  /** Maximum pool size (default: 100) */
  maxSize?: number
  /** Connection reuse timeout in milliseconds (default: 180000 = 3 minutes) */
  reuseTimeout?: number
}

/**
 * Enhanced connection metadata with management features
 */
export interface ManagedConnection extends ConnectionMetadata {
  /** Connection pool group */
  poolGroup?: string
  /** Rate limiting bucket */
  rateLimitBucket: RateLimitBucket
  /** Health status */
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
  /** Last health check timestamp */
  lastHealthCheck: number
  /** Connection tags for grouping and management */
  tags: Set<string>
  /** Custom metadata */
  customData: Map<string, any>
  /** Connection priority (1-10, 10 is highest) */
  priority: number
  /** Whether connection is eligible for cleanup */
  eligibleForCleanup: boolean
}

/**
 * Rate limiting bucket for per-IP tracking
 */
interface RateLimitBucket {
  /** IP address */
  ip: string
  /** Connection count in current window */
  connections: number
  /** Window start timestamp */
  windowStart: number
  /** Last connection timestamp */
  lastConnection: number
}

/**
 * Connection health check result
 */
interface HealthCheckResult {
  /** Whether connection is healthy */
  healthy: boolean
  /** Response time in milliseconds */
  responseTime?: number
  /** Error message if unhealthy */
  error?: string
}

/**
 * Connection manager events
 */
interface ConnectionManagerEvents {
  'connection:added': [connection: ManagedConnection]
  'connection:removed': [connectionId: string, reason: string]
  'connection:health': [connectionId: string, result: HealthCheckResult]
  'connection:idle': [connectionId: string, idleTime: number]
  'pool:full': [rejectedConnection: { ip: string, userAgent?: string }]
  'ratelimit:exceeded': [ip: string, attempt: number]
  'cleanup:started': []
  'cleanup:completed': [removedCount: number]
  'shutdown:started': []
  'shutdown:completed': []
  'error': [error: Error, context?: string]
}

/**
 * Advanced WebSocket Connection Manager
 * 
 * Provides comprehensive connection lifecycle management with features like:
 * - Connection pooling and limits
 * - Rate limiting per IP
 * - Health monitoring and checks
 * - Background cleanup services
 * - Graceful shutdown coordination
 * - Event-driven architecture
 */
export class ConnectionManager extends EventEmitter<ConnectionManagerEvents> {
  private connections = new Map<string, ManagedConnection>()
  private connectionsByIP = new Map<string, Set<string>>()
  private rateLimitBuckets = new Map<string, RateLimitBucket>()
  private cleanupInterval?: NodeJS.Timeout
  private healthCheckInterval?: NodeJS.Timeout
  private isShutdown = false
  private config: Required<ConnectionManagerConfig>

  constructor(config: ConnectionManagerConfig = {}) {
    super()
    
    // Set default configuration
    this.config = {
      maxConnections: config.maxConnections ?? 1000,
      maxConnectionsPerIP: config.maxConnectionsPerIP ?? 10,
      idleTimeout: config.idleTimeout ?? 300000, // 5 minutes
      rateLimitWindow: config.rateLimitWindow ?? 60000, // 1 minute
      rateLimitMaxConnections: config.rateLimitMaxConnections ?? 5,
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
      cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute
      upgradeTimeout: config.upgradeTimeout ?? 5000,
      enablePooling: config.enablePooling ?? true,
      enableRateLimit: config.enableRateLimit ?? true,
      enableHealthMonitoring: config.enableHealthMonitoring ?? true,
      customCleanupPolicy: config.customCleanupPolicy ?? (() => false)
    }

    this.startBackgroundServices()
  }

  /**
   * Check if a new connection can be accepted
   */
  canAcceptConnection(remoteAddress?: string): {
    allowed: boolean
    reason?: string
  } {
    if (this.isShutdown) {
      return { allowed: false, reason: 'Server is shutting down' }
    }

    // Check global connection limit
    if (this.config.enablePooling && this.connections.size >= this.config.maxConnections) {
      this.emit('pool:full', { ip: remoteAddress || 'unknown' })
      return { allowed: false, reason: 'Maximum connections reached' }
    }

    // Check per-IP connection limit
    if (remoteAddress && this.config.enablePooling) {
      const ipConnections = this.connectionsByIP.get(remoteAddress)
      if (ipConnections && ipConnections.size >= this.config.maxConnectionsPerIP) {
        return { allowed: false, reason: 'Maximum connections per IP reached' }
      }
    }

    // Check rate limiting
    if (remoteAddress && this.config.enableRateLimit) {
      const rateLimitResult = this.checkRateLimit(remoteAddress)
      if (!rateLimitResult.allowed) {
        this.emit('ratelimit:exceeded', remoteAddress, rateLimitResult.currentConnections || 0)
        return { allowed: false, reason: 'Rate limit exceeded' }
      }
    }

    return { allowed: true }
  }

  /**
   * Register a new managed connection
   */
  registerManagedConnection(
    socket: WebSocket,
    wsSocket: ws.WebSocket,
    req?: import('node:http').IncomingMessage,
    options: {
      poolGroup?: string
      tags?: string[]
      priority?: number
      customData?: Record<string, any>
    } = {}
  ): string {
    const remoteAddress = req?.socket.remoteAddress || req?.headers['x-forwarded-for'] as string
    const userAgent = req?.headers['user-agent']

    // Check if connection can be accepted
    const canAccept = this.canAcceptConnection(remoteAddress)
    if (!canAccept.allowed) {
      throw new Error(`Connection rejected: ${canAccept.reason}`)
    }

    // Register with base stats system
    const connectionId = registerConnection(socket, wsSocket, req)

    // Create rate limit bucket
    const rateLimitBucket = this.getOrCreateRateLimitBucket(remoteAddress)
    rateLimitBucket.connections++
    rateLimitBucket.lastConnection = Date.now()

    // Create managed connection
    const baseConnection = WebSocketStats.getConnection(connectionId)
    if (!baseConnection) {
      throw new Error('Failed to register connection with stats system')
    }

    const managedConnection: ManagedConnection = {
      ...baseConnection,
      poolGroup: options.poolGroup,
      rateLimitBucket,
      healthStatus: 'unknown',
      lastHealthCheck: 0,
      tags: new Set(options.tags || []),
      customData: new Map(Object.entries(options.customData || {})),
      priority: options.priority ?? 5,
      eligibleForCleanup: false
    }

    // Store connection
    this.connections.set(connectionId, managedConnection)

    // Track by IP
    if (remoteAddress) {
      if (!this.connectionsByIP.has(remoteAddress)) {
        this.connectionsByIP.set(remoteAddress, new Set())
      }
      this.connectionsByIP.get(remoteAddress)!.add(connectionId)
    }

    // Set up enhanced event listeners
    this.setupManagedConnectionEventListeners(managedConnection)

    this.emit('connection:added', managedConnection)

    return connectionId
  }

  /**
   * Remove a managed connection
   */
  removeManagedConnection(connectionId: string, reason: string = 'Unknown'): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    // Remove from IP tracking
    if (connection.remoteAddress) {
      const ipConnections = this.connectionsByIP.get(connection.remoteAddress)
      if (ipConnections) {
        ipConnections.delete(connectionId)
        if (ipConnections.size === 0) {
          this.connectionsByIP.delete(connection.remoteAddress)
        }
      }
    }

    // Update rate limit bucket
    if (connection.rateLimitBucket) {
      connection.rateLimitBucket.connections = Math.max(0, connection.rateLimitBucket.connections - 1)
    }

    // Remove from managed connections
    this.connections.delete(connectionId)

    this.emit('connection:removed', connectionId, reason)
  }

  /**
   * Get managed connection by ID
   */
  getManagedConnection(connectionId: string): ManagedConnection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get all managed connections
   */
  getAllManagedConnections(): ManagedConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connections by tag
   */
  getConnectionsByTag(tag: string): ManagedConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.tags.has(tag))
  }

  /**
   * Get connections by pool group
   */
  getConnectionsByPoolGroup(poolGroup: string): ManagedConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.poolGroup === poolGroup)
  }

  /**
   * Get connections by IP address
   */
  getConnectionsByIP(ip: string): ManagedConnection[] {
    const connectionIds = this.connectionsByIP.get(ip)
    if (!connectionIds) return []
    
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is ManagedConnection => conn !== undefined)
  }

  /**
   * Add tag to connection
   */
  addConnectionTag(connectionId: string, tag: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) return false
    
    connection.tags.add(tag)
    return true
  }

  /**
   * Remove tag from connection
   */
  removeConnectionTag(connectionId: string, tag: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) return false
    
    return connection.tags.delete(tag)
  }

  /**
   * Set custom data for connection
   */
  setConnectionData(connectionId: string, key: string, value: any): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) return false
    
    connection.customData.set(key, value)
    return true
  }

  /**
   * Get custom data for connection
   */
  getConnectionData(connectionId: string, key: string): any {
    const connection = this.connections.get(connectionId)
    return connection?.customData.get(key)
  }

  /**
   * Perform health check on a connection
   */
  async performHealthCheck(connectionId: string): Promise<HealthCheckResult> {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { healthy: false, error: 'Connection not found' }
    }

    const startTime = Date.now()

    try {
      // Check if socket is still open
      if (connection.state !== 'OPEN') {
        return { healthy: false, error: `Connection state is ${connection.state}` }
      }

      // Send ping and wait for pong (if WebSocket supports it)
      const wsSocket = connection.wsSocket
      if (wsSocket && typeof wsSocket.ping === 'function') {
        return new Promise<HealthCheckResult>((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ 
              healthy: false, 
              error: 'Health check timeout',
              responseTime: Date.now() - startTime
            })
          }, 5000)

          wsSocket.ping()
          wsSocket.once('pong', () => {
            clearTimeout(timeout)
            resolve({
              healthy: true,
              responseTime: Date.now() - startTime
            })
          })
        })
      }

      // Fallback: just check if connection is open
      return {
        healthy: connection.state === 'OPEN',
        responseTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }
    }
  }

  /**
   * Close connections by criteria
   */
  closeConnections(criteria: {
    tags?: string[]
    poolGroup?: string
    ip?: string
    olderThan?: number
    idleMoreThan?: number
    priority?: number
    unhealthy?: boolean
  }, code?: number, reason?: string): number {
    let closedCount = 0
    const connections = Array.from(this.connections.values())

    for (const connection of connections) {
      let shouldClose = true

      // Check criteria
      if (criteria.tags && !criteria.tags.some(tag => connection.tags.has(tag))) {
        shouldClose = false
      }
      if (criteria.poolGroup && connection.poolGroup !== criteria.poolGroup) {
        shouldClose = false
      }
      if (criteria.ip && connection.remoteAddress !== criteria.ip) {
        shouldClose = false
      }
      if (criteria.olderThan && connection.age < criteria.olderThan) {
        shouldClose = false
      }
      if (criteria.idleMoreThan && connection.idleTime < criteria.idleMoreThan) {
        shouldClose = false
      }
      if (criteria.priority !== undefined && connection.priority !== criteria.priority) {
        shouldClose = false
      }
      if (criteria.unhealthy && connection.healthStatus === 'healthy') {
        shouldClose = false
      }

      if (shouldClose) {
        try {
          if (code !== undefined || reason !== undefined) {
            connection.wsSocket.close(code, reason)
          } else {
            connection.socket.close()
          }
          closedCount++
        } catch (error) {
          console.warn(`Failed to close connection ${connection.id}:`, error)
        }
      }
    }

    return closedCount
  }

  /**
   * Get connection manager statistics
   */
  getManagerStats() {
    const connections = Array.from(this.connections.values())
    const now = Date.now()

    // Group by health status
    const healthStats = connections.reduce((acc, conn) => {
      acc[conn.healthStatus] = (acc[conn.healthStatus] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by pool group
    const poolStats = connections.reduce((acc, conn) => {
      const group = conn.poolGroup || 'default'
      acc[group] = (acc[group] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate idle connections
    const idleConnections = connections.filter(conn => 
      conn.idleTime > this.config.idleTimeout
    ).length

    return {
      totalManagedConnections: this.connections.size,
      connectionsByIP: this.connectionsByIP.size,
      rateLimitBuckets: this.rateLimitBuckets.size,
      healthStats,
      poolStats,
      idleConnections,
      config: this.config,
      isShutdown: this.isShutdown
    }
  }

  /**
   * Start background services
   */
  private startBackgroundServices(): void {
    // Start cleanup service
    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)

    // Start health monitoring
    if (this.config.enableHealthMonitoring) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks()
      }, this.config.healthCheckInterval)
    }
  }

  /**
   * Stop background services
   */
  private stopBackgroundServices(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Perform periodic cleanup
   */
  private async performCleanup(): Promise<void> {
    if (this.isShutdown) return

    this.emit('cleanup:started')
    let removedCount = 0

    const connections = Array.from(this.connections.values())
    const now = Date.now()

    for (const connection of connections) {
      let shouldRemove = false
      let reason = ''

      // Check if connection is closed but not cleaned up
      if (connection.state === 'CLOSED') {
        shouldRemove = true
        reason = 'Connection already closed'
      }
      // Check idle timeout
      else if (connection.idleTime > this.config.idleTimeout) {
        shouldRemove = true
        reason = 'Idle timeout exceeded'
        try {
          connection.wsSocket.close(1001, 'Idle timeout')
        } catch (error) {
          console.warn(`Failed to close idle connection ${connection.id}:`, error)
        }
      }
      // Check custom cleanup policy
      else if (this.config.customCleanupPolicy(connection)) {
        shouldRemove = true
        reason = 'Custom cleanup policy'
        try {
          connection.wsSocket.close(1000, 'Custom cleanup')
        } catch (error) {
          console.warn(`Failed to close connection ${connection.id} via custom policy:`, error)
        }
      }

      if (shouldRemove) {
        this.removeManagedConnection(connection.id, reason)
        removedCount++
      }
    }

    // Clean up old rate limit buckets
    for (const [ip, bucket] of this.rateLimitBuckets.entries()) {
      if (now - bucket.windowStart > this.config.rateLimitWindow && bucket.connections === 0) {
        this.rateLimitBuckets.delete(ip)
      }
    }

    this.emit('cleanup:completed', removedCount)
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    if (this.isShutdown) return

    const connections = Array.from(this.connections.values())
    
    // Perform health checks in batches to avoid overwhelming
    const batchSize = 10
    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (connection) => {
        try {
          const result = await this.performHealthCheck(connection.id)
          connection.healthStatus = result.healthy ? 'healthy' : 'unhealthy'
          connection.lastHealthCheck = Date.now()
          
          this.emit('connection:health', connection.id, result)
        } catch (error) {
          connection.healthStatus = 'unhealthy'
          connection.lastHealthCheck = Date.now()
          
          this.emit('connection:health', connection.id, {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }))
    }
  }

  /**
   * Check rate limiting for IP address
   */
  private checkRateLimit(ip: string): { allowed: boolean; currentConnections?: number } {
    const bucket = this.getOrCreateRateLimitBucket(ip)
    const now = Date.now()

    // Reset window if expired
    if (now - bucket.windowStart > this.config.rateLimitWindow) {
      bucket.connections = 0
      bucket.windowStart = now
    }

    return {
      allowed: bucket.connections < this.config.rateLimitMaxConnections,
      currentConnections: bucket.connections
    }
  }

  /**
   * Get or create rate limit bucket for IP
   */
  private getOrCreateRateLimitBucket(ip?: string): RateLimitBucket {
    const address = ip || 'unknown'
    
    if (!this.rateLimitBuckets.has(address)) {
      this.rateLimitBuckets.set(address, {
        ip: address,
        connections: 0,
        windowStart: Date.now(),
        lastConnection: Date.now()
      })
    }

    return this.rateLimitBuckets.get(address)!
  }

  /**
   * Set up enhanced event listeners for managed connection
   */
  private setupManagedConnectionEventListeners(connection: ManagedConnection): void {
    const { socket, id } = connection

    // Track idle time
    const trackActivity = () => {
      connection.lastActivity = Date.now()
    }

    socket.addEventListener('message', trackActivity)
    socket.addEventListener('error', trackActivity)

    // Handle close event
    socket.addEventListener('close', () => {
      this.removeManagedConnection(id, 'Connection closed')
    })

    // Monitor for idle connections
    const idleCheckInterval = setInterval(() => {
      if (connection.idleTime > this.config.idleTimeout / 2) {
        this.emit('connection:idle', id, connection.idleTime)
      }
    }, 60000) // Check every minute

    // Clean up interval when connection closes
    socket.addEventListener('close', () => {
      clearInterval(idleCheckInterval)
    })
  }

  /**
   * Graceful shutdown of connection manager
   */
  async shutdown(options: {
    timeout?: number
    closeCode?: number
    closeReason?: string
  } = {}): Promise<void> {
    if (this.isShutdown) return

    this.isShutdown = true
    this.emit('shutdown:started')

    const { timeout = 5000, closeCode = 1001, closeReason = 'Server shutting down' } = options

    try {
      // Stop background services
      this.stopBackgroundServices()

      // Close all connections
      const connections = Array.from(this.connections.values())
      const closePromises = connections.map(connection => {
        return new Promise<void>((resolve) => {
          const cleanup = () => {
            resolve()
          }

          connection.socket.addEventListener('close', cleanup)
          
          // Set timeout for forced close
          setTimeout(cleanup, 1000)

          try {
            connection.wsSocket.close(closeCode, closeReason)
          } catch (error) {
            console.warn(`Failed to close connection ${connection.id}:`, error)
            cleanup()
          }
        })
      })

      // Wait for all connections to close or timeout
      await Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, timeout))
      ])

      // Clear all data structures
      this.connections.clear()
      this.connectionsByIP.clear()
      this.rateLimitBuckets.clear()

      this.emit('shutdown:completed')
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)), 'shutdown')
      throw error
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Required<ConnectionManagerConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration (only some settings can be changed at runtime)
   */
  updateConfig(updates: Partial<Pick<ConnectionManagerConfig, 
    'maxConnections' | 'maxConnectionsPerIP' | 'idleTimeout' | 
    'rateLimitMaxConnections' | 'customCleanupPolicy'
  >>): void {
    Object.assign(this.config, updates)
  }
}

// Global singleton instance
let globalConnectionManager: ConnectionManager | undefined

/**
 * Get or create the global connection manager instance
 */
export function getConnectionManager(config?: ConnectionManagerConfig): ConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager(config)
  }
  return globalConnectionManager
}

/**
 * Reset the global connection manager (useful for testing)
 */
export function resetConnectionManager(): void {
  if (globalConnectionManager) {
    globalConnectionManager.shutdown()
    globalConnectionManager = undefined
  }
}

/**
 * Connection Manager API for easy access to common operations
 */
export const ConnectionManagerAPI = {
  /**
   * Get the global connection manager
   */
  getInstance: (config?: ConnectionManagerConfig) => getConnectionManager(config),

  /**
   * Register a new managed connection
   */
  register: (
    socket: WebSocket,
    wsSocket: ws.WebSocket,
    req?: import('node:http').IncomingMessage,
    options?: Parameters<ConnectionManager['registerManagedConnection']>[3]
  ) => getConnectionManager().registerManagedConnection(socket, wsSocket, req, options),

  /**
   * Get connection manager statistics
   */
  getStats: () => getConnectionManager().getManagerStats(),

  /**
   * Perform health check on all connections
   */
  healthCheck: async () => {
    const manager = getConnectionManager()
    const connections = manager.getAllManagedConnections()
    const results = await Promise.all(
      connections.map(async (conn) => ({
        id: conn.id,
        result: await manager.performHealthCheck(conn.id)
      }))
    )
    return results
  },

  /**
   * Close connections by criteria
   */
  closeConnections: (
    criteria: Parameters<ConnectionManager['closeConnections']>[0],
    code?: number,
    reason?: string
  ) => getConnectionManager().closeConnections(criteria, code, reason),

  /**
   * Graceful shutdown
   */
  shutdown: (options?: Parameters<ConnectionManager['shutdown']>[0]) => 
    getConnectionManager().shutdown(options)
} as const

export default ConnectionManagerAPI