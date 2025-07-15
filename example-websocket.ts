/**
 * Example WebSocket API route for Astro
 * 
 * This example shows how to use zastro-websockets in your Astro project
 * Save this as src/pages/api/websocket.ts in your Astro project
 */

import type { APIRoute } from 'astro'

export const GET: APIRoute = async (ctx) => {
  // Check if this is a WebSocket upgrade request
  if (ctx.locals.isUpgradeRequest) {
    // Upgrade the connection to WebSocket
    const { socket, response } = ctx.locals.upgradeWebSocket()
    
    // Handle WebSocket events
    socket.onopen = () => {
      console.log('WebSocket connected')
      socket.send('Welcome to the WebSocket server!')
    }
    
    socket.onmessage = (event) => {
      console.log('Received message:', event.data)
      
      // Echo the message back with a timestamp
      const reply = {
        type: 'echo',
        message: event.data,
        timestamp: new Date().toISOString()
      }
      
      socket.send(JSON.stringify(reply))
      
      // Handle special commands
      if (event.data === 'ping') {
        socket.send('pong')
      } else if (event.data === 'time') {
        socket.send(`Current time: ${new Date().toLocaleString()}`)
      } else if (event.data === 'close') {
        socket.close(1000, 'Goodbye!')
      }
    }
    
    socket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
    }
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    // Return the upgrade response
    return response
  }
  
  // If not a WebSocket request, return upgrade required
  return new Response('Upgrade to WebSocket required', { 
    status: 426,
    headers: {
      'Upgrade': 'websocket'
    }
  })
}

/**
 * Usage Instructions:
 * 
 * 1. Install zastro-websockets:
 *    npm install zastro-websockets
 * 
 * 2. Add the integration to your astro.config.mjs:
 *    import { defineConfig } from 'astro/config'
 *    import node from '@astrojs/node'
 *    import zastroWebSocket from 'zastro-websockets'
 * 
 *    export default defineConfig({
 *      output: 'server',
 *      adapter: node({ mode: 'standalone' }),
 *      integrations: [
 *        zastroWebSocket() // Auto-detects and patches your adapter
 *      ]
 *    })
 * 
 * 3. Connect from the client:
 *    const ws = new WebSocket('ws://localhost:4321/api/websocket')
 *    ws.onopen = () => ws.send('Hello WebSocket!')
 *    ws.onmessage = (event) => console.log('Received:', event.data)
 * 
 * 4. Test the connection:
 *    - Send "ping" to get "pong" back
 *    - Send "time" to get current server time
 *    - Send "close" to close the connection
 *    - Send any other message to get an echo with timestamp
 */