# WebSocket Implementation Usage Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install zastro-websockets ws @types/ws
```

### 2. Configure Astro

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config'
import node from 'zastro-websockets/node'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  })
})
```

### 3. Create WebSocket API Route

```typescript
// src/pages/api/websocket.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    
    socket.onopen = () => {
      console.log('🚀 WebSocket connection opened!')
      socket.send('Welcome to Astro WebSocket!')
    }
    
    socket.onmessage = (event) => {
      console.log('📨 Received:', event.data)
      
      if (event.data === 'ping') {
        socket.send('pong')
      } else {
        socket.send(`Echo: ${event.data}`)
      }
    }
    
    socket.onclose = () => {
      console.log('👋 WebSocket connection closed')
    }
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
    }
    
    return response
  }
  
  return new Response('WebSocket upgrade required', { 
    status: 426,
    headers: {
      'Upgrade': 'websocket'
    }
  })
}
```

### 4. Create Client Test Page

```astro
---
// src/pages/websocket-test.astro
---

<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>Astro WebSocket Test</h1>
    <div id="status">Connecting...</div>
    <div id="messages"></div>
    <input id="messageInput" type="text" placeholder="Type a message..." />
    <button id="sendButton">Send</button>

    <script>
        const ws = new WebSocket(`ws://localhost:4321/api/websocket`)
        const status = document.getElementById('status')
        const messages = document.getElementById('messages')
        const input = document.getElementById('messageInput')
        const button = document.getElementById('sendButton')

        ws.onopen = () => {
            status.textContent = '✅ Connected!'
            status.style.color = 'green'
        }

        ws.onmessage = (event) => {
            const msg = document.createElement('div')
            msg.textContent = `📨 ${event.data}`
            messages.appendChild(msg)
        }

        ws.onclose = () => {
            status.textContent = '❌ Disconnected'
            status.style.color = 'red'
        }

        button.onclick = () => {
            if (input.value) {
                ws.send(input.value)
                input.value = ''
            }
        }

        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                button.click()
            }
        }
    </script>
</body>
</html>
```

### 5. Test Your WebSocket

1. Start the dev server: `npm run dev`
2. Visit `http://localhost:4321/websocket-test`
3. Test the connection by sending messages

## Features Available

- ✅ Full WebSocket API compatibility
- ✅ Binary message support (ArrayBuffer, Blob)
- ✅ Proper event handling (onopen, onmessage, onerror, onclose)
- ✅ Development server support (Vite hot reload compatible)
- ✅ Production server support (standalone mode)
- ✅ TypeScript support with proper type definitions
- ✅ Multiple connection handling
- ✅ Automatic cleanup on disconnect

## Advanced Usage

### Binary Data

```typescript
// Sending binary data
const buffer = new ArrayBuffer(8)
const view = new Uint8Array(buffer)
view[0] = 255
socket.send(buffer)

// Receiving binary data
socket.binaryType = 'arraybuffer'
socket.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const view = new Uint8Array(event.data)
    console.log('Binary data:', view)
  }
}
```

### Room-based Communication

```typescript
// Simple room management
const rooms = new Map<string, Set<WebSocket>>()

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    const url = new URL(ctx.request.url)
    const room = url.searchParams.get('room') || 'default'
    
    if (!rooms.has(room)) {
      rooms.set(room, new Set())
    }
    rooms.get(room)!.add(socket)
    
    socket.onmessage = (event) => {
      // Broadcast to all sockets in the room
      for (const clientSocket of rooms.get(room)!) {
        if (clientSocket !== socket && clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data)
        }
      }
    }
    
    socket.onclose = () => {
      rooms.get(room)!.delete(socket)
      if (rooms.get(room)!.size === 0) {
        rooms.delete(room)
      }
    }
    
    return response
  }
  
  return new Response('WebSocket upgrade required', { status: 426 })
}
```

## Production Deployment

The adapter works in production mode. Build and run:

```bash
npm run build
npm run preview
```

Your WebSocket server will be available at the same domain as your Astro site.

## Troubleshooting

### Common Issues

1. **ctx.locals.isUpgradeRequest is undefined**
   - Make sure you're using `zastro-websockets/node` adapter
   - Verify the adapter is properly configured in astro.config.mjs

2. **WebSocket connection refused**
   - Check that the API route returns the response from `upgradeWebSocket()`
   - Verify the server is running on the expected port

3. **Type errors**
   - Make sure `@types/ws` is installed
   - Restart TypeScript server in your editor

### Debug Mode

Add logging to see what's happening:

```typescript
export const GET: APIRoute = (ctx) => {
  console.log('Request headers:', ctx.request.headers)
  console.log('Is upgrade request:', ctx.locals.isUpgradeRequest)
  
  if (ctx.locals.isUpgradeRequest) {
    console.log('Upgrading to WebSocket...')
    // ... rest of WebSocket code
  }
}
```