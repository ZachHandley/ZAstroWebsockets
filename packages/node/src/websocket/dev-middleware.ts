// Basic dev middleware for WebSocket support
export const onRequest = async function websocketDevMiddleware(
  context: any,
  next: () => Promise<Response>
): Promise<Response> {
  const { request, locals } = context
  
  // Check if this is a WebSocket upgrade request
  const isUpgradeRequest = request.headers.get('upgrade') === 'websocket'
  
  // Set up locals for non-upgrade requests
  locals.isUpgradeRequest = isUpgradeRequest
  locals.upgradeWebSocket = () => {
    throw new Error('The request must be an upgrade request to upgrade the connection to a WebSocket.')
  }
  
  return next()
}