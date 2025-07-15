/**
 * Example of using WebSockets with the Cloudflare adapter
 * 
 * This demonstrates how to create WebSocket endpoints using the
 * zastro-websockets package with Cloudflare Workers.
 */

import type { APIRoute } from 'astro'

// Example WebSocket endpoint for Cloudflare Workers
export const GET: APIRoute = (ctx) => {
    // Check if this is a WebSocket upgrade request
    if (ctx.locals.isUpgradeRequest) {
        // Upgrade the connection to WebSocket
        const { socket, response } = ctx.locals.upgradeWebSocket()
        
        // Set up WebSocket event handlers
        socket.onopen = () => {
            console.log('[cloudflare-websocket] Connection opened')
            socket.send(JSON.stringify({ 
                type: 'connection', 
                message: 'Connected to Cloudflare Workers WebSocket' 
            }))
        }
        
        socket.onmessage = (event) => {
            console.log('[cloudflare-websocket] Received:', event.data)
            
            try {
                const data = JSON.parse(event.data)
                
                // Echo back the message with a timestamp
                const response = {
                    type: 'echo',
                    timestamp: new Date().toISOString(),
                    original: data,
                    message: `Echo: ${data.message || 'No message'}`
                }
                
                socket.send(JSON.stringify(response))
                
                // Handle different message types
                switch (data.type) {
                    case 'ping':
                        socket.send(JSON.stringify({ 
                            type: 'pong', 
                            timestamp: new Date().toISOString() 
                        }))
                        break
                        
                    case 'broadcast':
                        // In a real application, you'd broadcast to other clients
                        // For Cloudflare, you might use Durable Objects for this
                        socket.send(JSON.stringify({ 
                            type: 'broadcast_ack', 
                            message: 'Broadcast received (would relay to other clients)' 
                        }))
                        break
                        
                    case 'close':
                        socket.close(1000, 'Client requested close')
                        break
                }
                
            } catch (error) {
                console.error('[cloudflare-websocket] Error parsing message:', error)
                socket.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Invalid JSON received' 
                }))
            }
        }
        
        socket.onclose = (event) => {
            console.log(`[cloudflare-websocket] Connection closed: ${event.code} ${event.reason}`)
        }
        
        socket.onerror = (event) => {
            console.error('[cloudflare-websocket] WebSocket error:', event)
        }
        
        // Return the upgrade response
        return response
    }
    
    // Return upgrade required for non-WebSocket requests
    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Cloudflare WebSocket Example</title>
</head>
<body>
    <h1>Cloudflare Workers WebSocket Example</h1>
    <p>This endpoint supports WebSocket connections.</p>
    
    <div>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
        <button onclick="ping()">Ping</button>
        <button onclick="sendMessage()">Send Message</button>
    </div>
    
    <div>
        <input type="text" id="messageInput" placeholder="Enter message..." />
        <button onclick="sendCustomMessage()">Send</button>
    </div>
    
    <div>
        <h3>Messages:</h3>
        <pre id="messages"></pre>
    </div>
    
    <script>
        let ws = null;
        const messages = document.getElementById('messages');
        
        function log(message) {
            messages.textContent += new Date().toISOString() + ': ' + message + '\\n';
            messages.scrollTop = messages.scrollHeight;
        }
        
        function connect() {
            if (ws) {
                log('Already connected');
                return;
            }
            
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + location.host + location.pathname);
            
            ws.onopen = () => log('Connected to WebSocket');
            ws.onmessage = (event) => log('Received: ' + event.data);
            ws.onclose = (event) => {
                log('Connection closed: ' + event.code + ' ' + event.reason);
                ws = null;
            };
            ws.onerror = (error) => log('Error: ' + error);
        }
        
        function disconnect() {
            if (ws) {
                ws.close();
            }
        }
        
        function ping() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            } else {
                log('Not connected');
            }
        }
        
        function sendMessage() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'test', 
                    message: 'Hello from Cloudflare Workers!' 
                }));
            } else {
                log('Not connected');
            }
        }
        
        function sendCustomMessage() {
            const input = document.getElementById('messageInput');
            if (ws && ws.readyState === WebSocket.OPEN && input.value.trim()) {
                ws.send(JSON.stringify({ 
                    type: 'custom', 
                    message: input.value.trim() 
                }));
                input.value = '';
            } else {
                log('Not connected or empty message');
            }
        }
    </script>
</body>
</html>
    `, {
        status: 200,
        headers: {
            'Content-Type': 'text/html'
        }
    })
}

// Advanced example showing room-based chat using Durable Objects
// (This would require additional setup with Cloudflare Durable Objects)
export const chatRoomExample: APIRoute = (ctx) => {
    if (ctx.locals.isUpgradeRequest) {
        const { socket, response } = ctx.locals.upgradeWebSocket()
        
        // In a real implementation, you'd get the room ID from the URL
        const roomId = new URL(ctx.request.url).searchParams.get('room') || 'general'
        
        socket.onopen = () => {
            // In production, you'd forward this to a Durable Object
            console.log(`[cloudflare-websocket] User joined room: ${roomId}`)
            socket.send(JSON.stringify({ 
                type: 'joined', 
                room: roomId,
                message: `Joined room ${roomId}` 
            }))
        }
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                
                // In production, you'd forward messages to the room's Durable Object
                // which would then broadcast to all connected clients in that room
                const chatMessage = {
                    type: 'chat',
                    room: roomId,
                    timestamp: new Date().toISOString(),
                    user: data.user || 'anonymous',
                    message: data.message
                }
                
                // Echo back for demo (in production, this would come from Durable Object)
                socket.send(JSON.stringify(chatMessage))
                
            } catch (error) {
                socket.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Invalid message format' 
                }))
            }
        }
        
        return response
    }
    
    return new Response('WebSocket upgrade required', { status: 426 })
}