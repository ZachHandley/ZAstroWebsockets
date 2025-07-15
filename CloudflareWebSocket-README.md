# Cloudflare Workers WebSocket Support

This package provides complete WebSocket support for Astro applications deployed to Cloudflare Workers using the `@astrojs/cloudflare` adapter.

## Features

- ✅ **Production WebSocket Support**: Full WebSocketPair API integration
- ✅ **Development Server**: WebSocket simulation for local development
- ✅ **Type Safety**: Complete TypeScript support with proper types
- ✅ **API Compatibility**: Same API as Node.js adapter for cross-platform compatibility
- ✅ **Cloudflare Integration**: Native integration with Cloudflare Workers runtime

## Installation

```bash
npm install zastro-websockets
```

## Configuration

### Basic Setup

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config'
import cloudflare from 'zastro-websockets/cloudflare'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Standard Cloudflare adapter options
    imageService: 'compile',
    platformProxy: {
      enabled: true
    }
  })
})
```

### Advanced Configuration

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config'
import cloudflare from 'zastro-websockets/cloudflare'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Image service configuration
    imageService: 'compile',
    
    // Platform proxy for development
    platformProxy: {
      enabled: true,
      configPath: './wrangler.toml'
    },
    
    // Custom worker entry point
    workerEntryPoint: {
      path: './src/worker.ts',
      namedExports: ['MyDurableObject']
    },
    
    // KV session binding
    sessionKVBindingName: 'SESSION',
    
    // Enable Cloudflare modules
    cloudflareModules: true,
    
    // Routes configuration
    routes: {
      extend: {
        include: [
          { pattern: '/api/*' },
          { pattern: '/ws/*' }
        ],
        exclude: [
          { pattern: '/static/*' }
        ]
      }
    }
  })
})
```

## Usage

### Basic WebSocket Endpoint

```ts
// src/pages/api/websocket.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    
    socket.onopen = () => {
      console.log('WebSocket connected')
      socket.send('Welcome to Cloudflare Workers!')
    }
    
    socket.onmessage = (event) => {
      console.log('Received:', event.data)
      socket.send(`Echo: ${event.data}`)
    }
    
    socket.onclose = () => {
      console.log('WebSocket disconnected')
    }
    
    return response
  }
  
  return new Response('Upgrade required', { status: 426 })
}
```

### Real-time Chat with Durable Objects

```ts
// src/pages/api/chat/[room].ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    const roomId = ctx.params.room
    
    // In production, you'd forward to a Durable Object
    // For this example, we'll simulate basic chat functionality
    
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'joined',
        room: roomId,
        timestamp: Date.now()
      }))
    }
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        // Echo message with metadata
        socket.send(JSON.stringify({
          type: 'message',
          room: roomId,
          user: data.user || 'anonymous',
          message: data.message,
          timestamp: Date.now()
        }))
        
        // In production, forward to Durable Object for broadcasting
        
      } catch (error) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON'
        }))
      }
    }
    
    return response
  }
  
  return new Response('WebSocket upgrade required', { status: 426 })
}
```

### WebSocket Client

```html
<!-- src/pages/chat.astro -->
<html>
<head>
  <title>Cloudflare WebSocket Chat</title>
</head>
<body>
  <div id="messages"></div>
  <input type="text" id="messageInput" placeholder="Type a message..." />
  <button onclick="sendMessage()">Send</button>
  
  <script>
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/api/chat/general`)
    const messages = document.getElementById('messages')
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const div = document.createElement('div')
      div.textContent = `${data.user}: ${data.message}`
      messages.appendChild(div)
    }
    
    function sendMessage() {
      const input = document.getElementById('messageInput')
      if (input.value.trim()) {
        ws.send(JSON.stringify({
          user: 'user123',
          message: input.value.trim()
        }))
        input.value = ''
      }
    }
    
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage()
    })
  </script>
</body>
</html>
```

## Advanced Features

### Integration with Durable Objects

For stateful WebSocket applications, integrate with Cloudflare Durable Objects:

```ts
// src/worker.ts (custom worker entry point)
export { default } from 'astro/dist/runtime/entrypoints/cloudflare.js'

// Durable Object for chat rooms
export class ChatRoom {
  constructor(private state: DurableObjectState, private env: Env) {}
  
  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)
    
    server.accept()
    
    // Handle WebSocket messages
    server.addEventListener('message', (event) => {
      // Broadcast to all connections in this room
      this.broadcast(event.data)
    })
    
    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }
  
  private broadcast(message: string) {
    // Implementation for broadcasting to all connections
  }
}
```

### Error Handling

```ts
export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    
    socket.onerror = (event) => {
      console.error('WebSocket error:', event)
    }
    
    socket.onclose = (event) => {
      if (event.code !== 1000) {
        console.error('WebSocket closed unexpectedly:', event.code, event.reason)
      }
    }
    
    // Set up heartbeat to detect connection issues
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      } else {
        clearInterval(heartbeat)
      }
    }, 30000)
    
    return response
  }
  
  return new Response('Upgrade required', { status: 426 })
}
```

## Development vs Production

### Development Mode
- Uses simulated WebSockets that work with Vite dev server
- WebSocket messages are echoed back for testing
- Full debugging support with console logs

### Production Mode  
- Uses native Cloudflare WebSocketPair API
- Full bidirectional communication
- Automatic connection acceptance
- Integration with Cloudflare's edge network

## Deployment

### Standard Deployment

```bash
# Build for production
npm run build

# Deploy with Wrangler
npx wrangler pages deploy dist
```

### With Durable Objects

```toml
# wrangler.toml
name = "my-astro-app"
compatibility_date = "2024-01-01"

[env.production]
name = "my-astro-app"

[[env.production.durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[env.production.migrations]]
tag = "v1"
new_classes = ["ChatRoom"]
```

## Troubleshooting

### Common Issues

1. **WebSocket not upgrading in development**
   - Ensure you're using the `zastro-websockets/cloudflare` adapter
   - Check that the request has the `Upgrade: websocket` header

2. **TypeScript errors with locals**
   - Make sure you have the correct type declarations
   - The adapter automatically extends `App.Locals` interface

3. **Deployment issues**
   - Verify wrangler.toml configuration
   - Check that WebSocket endpoints are included in routes

### Debug Mode

```ts
// Enable debug logging
export const GET: APIRoute = (ctx) => {
  console.log('Headers:', Object.fromEntries(ctx.request.headers))
  console.log('Is upgrade request:', ctx.locals.isUpgradeRequest)
  
  if (ctx.locals.isUpgradeRequest) {
    console.log('Upgrading to WebSocket...')
    // ... rest of implementation
  }
}
```

## Limits and Considerations

### Cloudflare Workers Limits
- WebSocket messages: 1 MiB maximum size
- Connection duration: No hard limit, but consider timeouts
- Concurrent connections: Subject to Cloudflare Workers limits

### Billing
- WebSocket connections count as requests for billing
- Incoming messages have a 20:1 ratio (100 messages = 5 requests)
- Outgoing messages and pings are free

## Migration from Node.js

The API is identical to the Node.js adapter:

```ts
// Works on both Node.js and Cloudflare
export const GET: APIRoute = (ctx) => {
  if (ctx.locals.isUpgradeRequest) {
    const { socket, response } = ctx.locals.upgradeWebSocket()
    // ... same code works on both platforms
    return response
  }
  return new Response('Upgrade required', { status: 426 })
}
```

## Examples

See `example-cloudflare-websocket.ts` for comprehensive examples including:
- Basic echo server
- Real-time chat simulation  
- Error handling patterns
- Client-side JavaScript integration

## Support

- Cloudflare Workers WebSocket documentation: https://developers.cloudflare.com/workers/runtime-apis/websockets/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- This package: Create an issue on GitHub