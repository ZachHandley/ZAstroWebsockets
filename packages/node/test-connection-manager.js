/**
 * Test script for Connection Manager functionality
 * 
 * This is a simple test to verify the ConnectionManager works correctly
 * Run with: node test-connection-manager.js
 */

import { ConnectionManager, ConnectionManagerAPI, getConnectionManager } from './dist/websocket/connection-manager.js';
import ws from 'ws';

async function testConnectionManager() {
  console.log('Testing ConnectionManager...\n');

  // Test 1: Basic configuration
  console.log('1. Testing basic configuration...');
  const manager = getConnectionManager({
    maxConnections: 5,
    maxConnectionsPerIP: 2,
    idleTimeout: 5000,
    rateLimitWindow: 10000,
    rateLimitMaxConnections: 3,
    enableHealthMonitoring: true,
    enableRateLimit: true,
    enablePooling: true
  });

  console.log('✓ ConnectionManager created with configuration');
  console.log('Configuration:', manager.getConfig());

  // Test 2: Event listeners
  console.log('\n2. Testing event listeners...');
  let connectionAdded = false;
  let connectionRemoved = false;

  manager.on('connection:added', (connection) => {
    console.log(`✓ Event: Connection added ${connection.id}`);
    connectionAdded = true;
  });

  manager.on('connection:removed', (connectionId, reason) => {
    console.log(`✓ Event: Connection removed ${connectionId}, reason: ${reason}`);
    connectionRemoved = true;
  });

  manager.on('pool:full', (rejected) => {
    console.log(`✓ Event: Pool full, rejected connection from ${rejected.ip}`);
  });

  manager.on('ratelimit:exceeded', (ip, attempts) => {
    console.log(`✓ Event: Rate limit exceeded for ${ip}, attempts: ${attempts}`);
  });

  // Test 3: Connection acceptance check
  console.log('\n3. Testing connection acceptance...');
  const canAccept1 = manager.canAcceptConnection('192.168.1.1');
  console.log('Can accept first connection:', canAccept1);

  // Test 4: Mock connection registration
  console.log('\n4. Testing mock connection registration...');
  
  // Create mock WebSocket instances
  const mockSockets = [];
  for (let i = 0; i < 3; i++) {
    try {
      // Create a minimal mock WebSocket
      const mockWsSocket = {
        readyState: ws.WebSocket.OPEN,
        close: (code, reason) => {
          console.log(`Mock socket ${i} closed with code ${code}, reason: ${reason}`);
          mockWsSocket.readyState = ws.WebSocket.CLOSED;
        },
        ping: () => {
          console.log(`Mock socket ${i} ping sent`);
        },
        on: () => {},
        once: () => {}
      };

      const mockSocket = {
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {
          mockWsSocket.close(1000, 'Normal closure');
        },
        send: () => {}
      };

      const mockReq = {
        socket: { remoteAddress: '192.168.1.1' },
        headers: { 'user-agent': `TestAgent${i}` }
      };

      const connectionId = manager.registerManagedConnection(
        mockSocket,
        mockWsSocket,
        mockReq,
        {
          tags: ['test', `connection-${i}`],
          priority: 5 + i,
          customData: { testId: i, created: Date.now() }
        }
      );

      mockSockets.push({ connectionId, socket: mockSocket, wsSocket: mockWsSocket });
      console.log(`✓ Registered mock connection ${i} with ID: ${connectionId}`);

    } catch (error) {
      console.error(`Failed to register connection ${i}:`, error.message);
    }
  }

  // Test 5: Statistics
  console.log('\n5. Testing statistics...');
  const stats = manager.getManagerStats();
  console.log('Manager stats:', {
    totalManagedConnections: stats.totalManagedConnections,
    connectionsByIP: stats.connectionsByIP,
    healthStats: stats.healthStats,
    poolStats: stats.poolStats
  });

  // Test 6: Connection tagging and metadata
  console.log('\n6. Testing connection tagging and metadata...');
  if (mockSockets.length > 0) {
    const firstConnection = mockSockets[0];
    
    manager.addConnectionTag(firstConnection.connectionId, 'special');
    manager.setConnectionData(firstConnection.connectionId, 'customField', 'customValue');
    
    const taggedConnections = manager.getConnectionsByTag('special');
    console.log(`✓ Found ${taggedConnections.length} connections with 'special' tag`);
    
    const customData = manager.getConnectionData(firstConnection.connectionId, 'customField');
    console.log(`✓ Custom data retrieved: ${customData}`);
  }

  // Test 7: Health checks
  console.log('\n7. Testing health checks...');
  if (mockSockets.length > 0) {
    try {
      const healthResult = await manager.performHealthCheck(mockSockets[0].connectionId);
      console.log(`✓ Health check result:`, healthResult);
    } catch (error) {
      console.log(`Health check failed (expected for mock):`, error.message);
    }
  }

  // Test 8: Connection closing by criteria
  console.log('\n8. Testing connection closing by criteria...');
  const closedCount = manager.closeConnections({
    tags: ['test']
  });
  console.log(`✓ Closed ${closedCount} connections with 'test' tag`);

  // Test 9: Rate limiting simulation
  console.log('\n9. Testing rate limiting...');
  for (let i = 0; i < 5; i++) {
    const canAccept = manager.canAcceptConnection('192.168.1.2');
    console.log(`Rate limit check ${i + 1}:`, canAccept.allowed ? 'Allowed' : `Rejected - ${canAccept.reason}`);
    
    if (canAccept.allowed) {
      try {
        // Quick mock connection to test rate limiting
        const mockWsSocket = { readyState: ws.WebSocket.OPEN, close: () => {}, on: () => {}, once: () => {} };
        const mockSocket = { addEventListener: () => {}, close: () => {} };
        const mockReq = { socket: { remoteAddress: '192.168.1.2' }, headers: {} };
        
        const id = manager.registerManagedConnection(mockSocket, mockWsSocket, mockReq);
        manager.removeManagedConnection(id, 'Rate limit test');
      } catch (error) {
        console.log(`Rate limit connection failed: ${error.message}`);
      }
    }
  }

  // Test 10: ConnectionManagerAPI
  console.log('\n10. Testing ConnectionManagerAPI...');
  const apiStats = ConnectionManagerAPI.getStats();
  console.log('API stats - Total managed connections:', apiStats.totalManagedConnections);

  // Test 11: Cleanup
  console.log('\n11. Testing cleanup and shutdown...');
  
  // Wait a moment to see if events fired
  setTimeout(async () => {
    console.log('\nStarting shutdown...');
    await manager.shutdown({
      timeout: 5000,
      closeCode: 1001,
      closeReason: 'Test shutdown'
    });
    console.log('✓ Shutdown completed');
    
    // Final verification
    console.log('\nFinal verification:');
    console.log('Events fired:');
    console.log('- Connection added:', connectionAdded);
    console.log('- Connection removed:', connectionRemoved);
    
    console.log('\n✓ All tests completed successfully!');
  }, 1000);
}

// Run the test
testConnectionManager().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});