import type { APIRoute } from 'astro'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { response, socket } = ctx.locals.upgradeWebSocket()
    
    socket.onopen = () => {
      console.log('WebSocket connected')
      socket.send('Welcome to Node.js WebSocket!')
    }
    
    socket.onmessage = (event) => {
      console.log('Received:', event.data)
      if (event.data === 'ping') {
        socket.send('pong')
      } else {
        socket.send(`Echo: ${event.data}`)
      }
    }
    
    socket.onclose = () => {
      console.log('WebSocket disconnected')
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return response
  }
  
  return new Response('Upgrade required', { status: 426 })
}