import type { APIRoute } from 'astro'
import { WebSocketStats } from 'zastro-websockets-node/stats'

export const GET: APIRoute = () => {
  const stats = WebSocketStats.getConnectionStats()
  
  return new Response(JSON.stringify({
    success: true,
    stats: stats
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    
    switch (body.action) {
      case 'get_stats':
        const stats = WebSocketStats.getConnectionStats()
        return new Response(JSON.stringify({
          success: true,
          data: stats
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'close_all':
        WebSocketStats.closeAllConnections(1000, 'Administrative close')
        return new Response(JSON.stringify({
          success: true,
          message: 'All connections closed'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'cleanup_stale':
        const cleaned = WebSocketStats.cleanupStaleConnections()
        return new Response(JSON.stringify({
          success: true,
          message: `Cleaned up ${cleaned} stale connections`
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'get_active':
        const activeConnections = WebSocketStats.getActiveConnections()
        return new Response(JSON.stringify({
          success: true,
          data: {
            count: activeConnections.size,
            connections: Array.from(activeConnections).map(() => ({ status: 'active' }))
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
        
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Unknown action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}