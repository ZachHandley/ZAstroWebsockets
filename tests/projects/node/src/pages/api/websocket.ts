import type { APIRoute } from 'astro'
import { WebSocketStats } from 'zastro-websockets-node'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { response, socket } = ctx.locals.upgradeWebSocket()
    
    socket.onopen = () => {
      console.log('WebSocket connected')
      console.log(`Total connections: ${WebSocketStats.getConnectionCount()}`)
      socket.send('Welcome to Node.js WebSocket!')
      
      // Send connection stats as a welcome message
      const stats = WebSocketStats.getConnectionStats()
      socket.send(JSON.stringify({
        type: 'stats',
        data: {
          totalConnections: stats.totalConnections,
          totalConnectionsEver: stats.totalConnectionsEver
        }
      }))
    }
    
    socket.onmessage = (event) => {
      console.log('Received:', event.data)
      
      if (event.data === 'ping') {
        socket.send('pong')
      } else if (event.data === 'stats') {
        // Send current connection statistics
        const stats = WebSocketStats.getConnectionStats()
        socket.send(JSON.stringify({
          type: 'stats',
          data: stats
        }))
      } else {
        socket.send(`Echo: ${event.data}`)
      }
    }
    
    socket.onclose = () => {
      console.log('WebSocket disconnected')
      console.log(`Remaining connections: ${WebSocketStats.getConnectionCount()}`)
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return response
  }
  
  return new Response('Upgrade required', { status: 426 })
}