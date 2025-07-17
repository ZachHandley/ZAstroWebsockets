#!/usr/bin/env node

/**
 * Dynamic Node.js WebSocket patch generator
 * Follows the 5-step process: copy upstream → modify local → update package.json → install deps → build
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export function applyNodeWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Node.js WebSocket patch by modifying upstream directly...')
  
  const upstreamNodeDir = join(astroUpstreamDir, 'packages/integrations/node')
  const finalNodeDir = join(rootDir, 'packages/node')
  
  if (!existsSync(upstreamNodeDir)) {
    throw new Error(`Upstream node directory not found: ${upstreamNodeDir}`)
  }
  
  try {
    // Step 1: Apply patch modifications directly to upstream
    console.log('🔧 Step 1: Applying patch modifications to upstream Node adapter')
    applyAllPatchModifications(upstreamNodeDir)
    
    // Step 2: Update package.json in upstream (minimal changes only)
    console.log('📝 Step 2: Updating package.json in upstream adapter')
    updateUpstreamPackageJson(upstreamNodeDir)
    
    // Step 2.1: Install dependencies in upstream workspace (allow lockfile updates)
    console.log('📦 Step 2.1: Installing dependencies in upstream workspace')
    execSync('pnpm install --no-frozen-lockfile', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Step 3: Build in upstream workspace
    console.log('🏗️ Step 3: Building in upstream workspace')
    execSync('pnpm run build --filter @astrojs/node', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Step 4: Copy built dist folder to our final package
    console.log('📦 Step 4: Copying built dist to final package location')
    if (existsSync(finalNodeDir)) {
      rmSync(finalNodeDir, { recursive: true })
    }
    mkdirSync(finalNodeDir, { recursive: true })
    
    const upstreamDistDir = join(upstreamNodeDir, 'dist')
    const finalDistDir = join(finalNodeDir, 'dist')
    if (existsSync(upstreamDistDir)) {
      cpSync(upstreamDistDir, finalDistDir, { recursive: true })
      console.log('✅ Built dist folder copied successfully')
    }
    
    // Copy and modify upstream package.json for our package
    copyAndModifyUpstreamPackageJson(upstreamNodeDir, finalNodeDir)
    
    console.log('✅ Node.js WebSocket patch applied successfully')
    
    // Return restore function to reset upstream changes
    return () => {
      console.log('🔄 Restoring upstream Node adapter to original state...')
      execSync('git checkout HEAD -- packages/integrations/node/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    }
    
  } catch (error) {
    // Restore upstream on error
    console.log('🔄 Restoring upstream due to error...')
    try {
      execSync('git checkout HEAD -- packages/integrations/node/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    } catch (restoreError) {
      console.warn('⚠️ Failed to restore upstream:', restoreError.message)
    }
    console.error('❌ Error applying Node.js WebSocket patch:', error.message)
    throw error
  }
}

/**
 * Apply all patch modifications directly to upstream
 */
function applyAllPatchModifications(upstreamNodeDir: string) {
  const srcDir = join(upstreamNodeDir, 'src')
  const websocketDir = join(srcDir, 'websocket')
  const middlewareDir = join(srcDir, 'middleware')
  
  // Create directories
  mkdirSync(websocketDir, { recursive: true })
  mkdirSync(middlewareDir, { recursive: true })
  
  // Apply modifications to existing files
  applyServeAppModifications(srcDir)
  applyStandaloneModifications(srcDir)
  applyTypesModifications(srcDir)
  applyIndexModifications(srcDir)
  
  // Internal helpers imports should work with package exports - no fixes needed
  
  // Create new WebSocket files
  createWebSocketFiles(websocketDir, middlewareDir)
}


/**
 * Apply serve-app.ts modifications
 */
function applyServeAppModifications(srcDir: string) {
  const serveAppPath = join(srcDir, 'serve-app.ts')
  if (!existsSync(serveAppPath)) return
  
  let content = readFileSync(serveAppPath, 'utf-8')
  
  // Change function signature: add default value for locals
  content = content.replace(
    /return async \(req, res, next, locals\) => {/,
    'return async (req, res, next, locals = {}) => {'
  )
  
  // Add WebSocket upgrade locals before routeData
  if (!content.includes('isUpgradeRequest: false')) {
    content = content.replace(
      /(\s+)const routeData = app\.match\(request\);/,
      `$1/**
		 * An upgrade request will be handled by a listener attached to the \`upgrade\` event,
		 * which is the returned function from createWebsocketHandler().
		 *
		 * The fact that a request is being handled by this function, a listener for the
		 * \`request\` event, means that the request was not an upgrade request.
		 */
		Object.assign(locals, {
			isUpgradeRequest: false,
			upgradeWebSocket() {
				throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.")
			}
		})
$1const routeData = app.match(request);`
    )
  }
  
  writeFileSync(serveAppPath, content)
}

/**
 * Apply standalone.ts modifications
 */
function applyStandaloneModifications(srcDir: string) {
  const standalonePath = join(srcDir, 'standalone.ts')
  if (!existsSync(standalonePath)) return
  
  let content = readFileSync(standalonePath, 'utf-8')
  
  // Add WebSocket import
  if (!content.includes('createWebsocketHandler')) {
    content = content.replace(
      /import { createStaticHandler } from '\.\/serve-static\.js';/,
      `import { createStaticHandler } from './serve-static.js';
import { createWebsocketHandler } from "./websocket/serve-websocket.js";`
    )
  }
  
  // Add WebSocket upgrade handler
  if (!content.includes('server.server.on("upgrade"')) {
    content = content.replace(
      /const server = createServer\(handler, host, port\);/,
      `const server = createServer(handler, host, port);
	// Add WebSocket upgrade handler
	server.server.on("upgrade", createWebsocketHandler(app))`
    )
  }
  
  writeFileSync(standalonePath, content)
}

/**
 * Apply types.ts modifications
 */
function applyTypesModifications(srcDir: string) {
  const typesPath = join(srcDir, 'types.ts')
  if (!existsSync(typesPath)) return
  
  let content = readFileSync(typesPath, 'utf-8')
  
  // Export RequestHandlerParams type
  content = content.replace(
    /type RequestHandlerParams = \[/,
    'export type RequestHandlerParams = ['
  )
  
  // Change locals type
  content = content.replace(
    /locals\?: object,/,
    'locals?: { [key: string]: any },'
  )
  
  writeFileSync(typesPath, content)
}

/**
 * Apply index.ts modifications
 */
function applyIndexModifications(srcDir: string) {
  const indexPath = join(srcDir, 'index.ts')
  if (!existsSync(indexPath)) return
  
  let content = readFileSync(indexPath, 'utf-8')
  
  // Replace adapter name
  content = content.replace(
    /name: '@astrojs\/node'/g,
    "name: 'zastro-websockets-node'"
  )
  
  // Replace server entrypoint
  content = content.replace(
    /serverEntrypoint: '@astrojs\/node\/server\.js'/g,
    "serverEntrypoint: 'zastro-websockets-node/server.js'"
  )
  
  // Replace preview entrypoint
  content = content.replace(
    /previewEntrypoint: '@astrojs\/node\/preview\.js'/g,
    "previewEntrypoint: 'zastro-websockets-node/preview.js'"
  )
  
  // Import paths should work with package exports - no changes needed
  
  writeFileSync(indexPath, content)
}

/**
 * Update package.json in upstream (minimal changes only)
 */
function updateUpstreamPackageJson(upstreamNodeDir: string): void {
  const packageJsonPath = join(upstreamNodeDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Add websocket exports - keep everything else unchanged
  if (!packageJson.exports) {
    packageJson.exports = {}
  }
  packageJson.exports['./websocket'] = './dist/websocket/index.js'
  packageJson.exports['./stats'] = './dist/websocket/stats.js'
  
  // Add WebSocket dependencies
  if (!packageJson.dependencies) {
    packageJson.dependencies = {}
  }
  packageJson.dependencies.ws = '^8.18.0'
  
  // Add WebSocket type dependencies
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {}
  }
  packageJson.devDependencies['@types/ws'] = '^8.5.12'
  
  // Convert workspace dependencies in upstream BEFORE building
  console.log('🔄 Converting workspace dependencies in upstream package.json before build...')
  if (packageJson.dependencies) {
    for (const [dep, version] of Object.entries(packageJson.dependencies)) {
      if (version === 'workspace:*') {
        // Map package name to workspace directory
        let packageDir = ''
        if (dep.startsWith('@astrojs/')) {
          const packageName = dep.replace('@astrojs/', '')
          if (packageName === 'internal-helpers') {
            packageDir = 'internal-helpers'
          } else if (packageName === 'underscore-redirects') {
            packageDir = 'underscore-redirects'
          } else {
            packageDir = `integrations/${packageName}`
          }
        } else if (dep === 'astro') {
          packageDir = 'astro'
        } else if (dep === 'astro-scripts') {
          packageDir = '../../scripts'
        }
        
        if (packageDir) {
          const depPackageJsonPath = join(upstreamNodeDir, `../../${packageDir}/package.json`)
          if (existsSync(depPackageJsonPath)) {
            const depPackageJson = JSON.parse(readFileSync(depPackageJsonPath, 'utf-8'))
            packageJson.dependencies[dep] = `^${depPackageJson.version}`
            console.log(`  ✅ Upstream: Resolved ${dep}@workspace:* → ^${depPackageJson.version}`)
          } else {
            console.warn(`  ⚠️ Could not find package.json for ${dep} at ${depPackageJsonPath}`)
          }
        }
      }
    }
  }
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('✅ Updated upstream package.json with websocket exports and resolved dependencies')
}

function copyAndModifyUpstreamPackageJson(upstreamNodeDir: string, finalNodeDir: string): void {
  // Read the upstream package.json (which already has our WebSocket export)
  const upstreamPackageJsonPath = join(upstreamNodeDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(upstreamPackageJsonPath, 'utf-8'))
  
  // Only modify what we need for our renamed package
  packageJson.name = 'zastro-websockets-node'
  packageJson.description = 'Deploy your site to a Node.js server with WebSocket support'
  packageJson.author = 'Zach Handley <zach@zachhandley.com>'
  packageJson.repository = {
    type: 'git',
    url: 'https://github.com/zachhandley/ZAstroWebsockets.git'
  }
  
  // Add websockets keyword
  if (!packageJson.keywords.includes('websockets')) {
    packageJson.keywords.push('websockets')
  }
  
  // Convert ALL workspace dependencies to actual versions from upstream workspace
  if (packageJson.dependencies) {
    for (const [dep, version] of Object.entries(packageJson.dependencies)) {
      if (version === 'workspace:*') {
        // Map package name to workspace directory
        let packageDir = ''
        if (dep.startsWith('@astrojs/')) {
          // Handle @astrojs scoped packages
          const packageName = dep.replace('@astrojs/', '')
          if (packageName === 'internal-helpers') {
            packageDir = 'internal-helpers'
          } else if (packageName === 'underscore-redirects') {
            packageDir = 'underscore-redirects'
          } else {
            packageDir = `integrations/${packageName}`
          }
        } else if (dep === 'astro') {
          packageDir = 'astro'
        } else if (dep === 'astro-scripts') {
          packageDir = '../../scripts'
        }
        
        if (packageDir) {
          const depPackageJsonPath = join(upstreamNodeDir, `../../${packageDir}/package.json`)
          if (existsSync(depPackageJsonPath)) {
            const depPackageJson = JSON.parse(readFileSync(depPackageJsonPath, 'utf-8'))
            packageJson.dependencies[dep] = `^${depPackageJson.version}`
            console.log(`  ✅ Resolved ${dep}@workspace:* → ^${depPackageJson.version}`)
          } else {
            console.warn(`  ⚠️ Could not find package.json for ${dep} at ${depPackageJsonPath}`)
            delete packageJson.dependencies[dep]
          }
        } else {
          console.warn(`  ⚠️ Unknown workspace package ${dep}, removing from dependencies`)
          delete packageJson.dependencies[dep]
        }
      }
    }
  }
  
  // Remove workspace-specific fields that don't apply to our standalone package
  delete packageJson.bugs
  delete packageJson.homepage
  delete packageJson.scripts
  delete packageJson.devDependencies
  delete packageJson.publishConfig
  
  const packageJsonPath = join(finalNodeDir, 'package.json')
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('✅ Created final package.json for zastro-websockets-node based on upstream')
}

/**
 * Create ALL WebSocket files from patch content as code generation
 */
function createWebSocketFiles(websocketDir: string, middlewareDir: string) {
  // Create attach.ts
  const attachContent = `import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

// WeakMap to store private WebSocket instances
const wsMap = new WeakMap<WebSocket, ws.WebSocket>()

// Hidden attachment function
const attacher: { attach: null | typeof attachImpl } = { attach: null }

function attachImpl(standard: WebSocket, ws: ws.WebSocket): void {
    if (wsMap.has(standard)) {
        throw new Error("WebSocket already attached")
    }
    wsMap.set(standard, ws)
}

// Initialize the attacher
attacher.attach = attachImpl

export function attach(standard: WebSocket, ws: ws.WebSocket): void {
    return attacher.attach?.(standard, ws)
}`
  writeFileSync(join(websocketDir, 'attach.ts'), attachContent)
  
  // Create response.ts
  const responseContent = `import { pipeline } from "node:stream/promises"

export class UpgradeResponse extends Response {
    readonly status = 101

    constructor() {
        super(null, {
            status: 101,
            statusText: "Switching Protocols",
            headers: {
                "Upgrade": "websocket",
                "Connection": "Upgrade"
            }
        })
    }
}

export async function writeResponseToSocket(socket: import("node:stream").Duplex, response: Response) {
    let head = \`HTTP/1.1 \${response.status}\`
    if (response.statusText) head += \` \${response.statusText}\`
    head += \`\\r\\n\`

    for (const [name, value] of response.headers) {
        head += \`\${name}: \${value}\\r\\n\`
    }

    socket.write(head + "\\r\\n")

    if (response.body) {
        await pipeline(response.clone().body!, socket)
    }
}`
  writeFileSync(join(websocketDir, 'response.ts'), responseContent)
  
  // Create serve-websocket.ts
  const serveWebsocketContent = `import * as ws from "ws"
import { NodeApp } from "astro/app/node"
import { WebSocket } from "./websocket.js"
import { attach } from "./attach.js"
import { UpgradeResponse, writeResponseToSocket } from "./response.js"

export type UpgradeHandler =
    import("node:http").Server["on"] extends
        (event: "upgrade", callback: infer UpgradeHandler) => unknown
            ? UpgradeHandler
            : never

export function createWebsocketHandler(app: NodeApp): UpgradeHandler {
    /**
     * The websocket instance is created as soon as
     * \`locals.upgradeWebSocket()\` is called. It gets
     * attached to an actual connection once the app
     * code returns a response.
     *
     * This map is used to keep track of the
     * responses' associated websocket instance.
     */
    const responseToSocketMap = new WeakMap<Response, WebSocket>
    const server = new ws.WebSocketServer({ noServer: true })

    return async (req, socket, head) => {
        const response = await app.render(NodeApp.createRequest(req), {
            addCookieHeader: true,
            locals: {
                isUpgradeRequest: true,
                upgradeWebSocket() {
                    const socket = new WebSocket
                    const response = new UpgradeResponse
                    responseToSocketMap.set(response, socket)
                    return { socket, response }
                }
            }
        })

        if (response instanceof UpgradeResponse) {
            const websocket = responseToSocketMap.get(response)!
            server.handleUpgrade(req, socket, head, (wsSocket: ws.WebSocket) => attach(websocket, wsSocket))
        } else {
            await writeResponseToSocket(socket, response)
        }
    }
}`
  writeFileSync(join(websocketDir, 'serve-websocket.ts'), serveWebsocketContent)
  
  // Create websocket.ts - the main WebSocket class
  const websocketContent = `import type * as ws from "ws"

type WebSocketInterface = globalThis.WebSocket

// WeakMap to store private WebSocket instances
const wsMap = new WeakMap<WebSocket, ws.WebSocket>()

// To keep the internals hidden
export const attacher: { attach: null | typeof attachImpl } = { attach: null }

export class WebSocket extends EventTarget implements WebSocketInterface {

    static readonly CONNECTING = 0 as const
    static readonly OPEN       = 1 as const
    static readonly CLOSING    = 2 as const
    static readonly CLOSED     = 3 as const

    get url() {
        const ws = wsMap.get(this)
        return ws?.url ?? ""
    }

    // ready state
    declare readonly CONNECTING: 0
    declare readonly OPEN      : 1
    declare readonly CLOSING   : 2
    declare readonly CLOSED    : 3

    get readyState() {
        const ws = wsMap.get(this)
        return ws?.readyState ?? this.CONNECTING
    }

    get bufferedAmount() {
        const ws = wsMap.get(this)
        return ws?.bufferedAmount ?? 0
    }

    // networking
    onopen : WebSocketInterface["onopen"]  = null
    onerror: WebSocketInterface["onerror"] = null
    onclose: WebSocketInterface["onclose"] = null

    get extensions() {
        const ws = wsMap.get(this)
        return ws?.extensions ?? ""
    }

    get protocol() {
        const ws = wsMap.get(this)
        return ws?.protocol ?? ""
    }

    close() {
        const ws = wsMap.get(this)
        if (ws) ws.close()
        else this.addEventListener("open", () => this.close(), { once: true })
    }

    // messaging
    onmessage : WebSocketInterface["onmessage"] = null

    get binaryType() {
        const ws = wsMap.get(this)
        return ws?.binaryType as "arraybuffer" | "blob" ?? "blob"
    }

    set binaryType(value: "arraybuffer" | "blob") {
        const ws = wsMap.get(this)
        if (ws) {
            // Use Object.assign instead of type assertion for better type safety
            Object.assign(ws, { binaryType: value })
        } else {
            this.addEventListener("open", () => this.binaryType = value, { once: true })
        }
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        const ws = wsMap.get(this)
        if (data instanceof Blob) data.arrayBuffer().then(buffer => ws!.send(buffer))
        else ws!.send(data)
    }

    static {
        Object.assign(this.prototype, {
            CONNECTING: 0,
            OPEN      : 1,
            CLOSING   : 2,
            CLOSED    : 3
        })

        // Freeze the prototype and class to align the object shape with the spec
        Object.freeze(this.prototype)
        Object.freeze(this)

        attacher.attach = attachImpl
    }
}

function attachImpl(standard: WebSocket, ws: ws.WebSocket): void {
    // Use a WeakMap to store private WebSocket instances
    if (wsMap.has(standard)) {
        throw new Error("WebSocket already attached")
    }
    wsMap.set(standard, ws)
    init(standard, ws)
}

function init(standard: WebSocket, ws: ws.WebSocket) {
    // Set the binary type to "blob" to align with the browser default
    // Use Object.assign instead of type assertion for better type safety
    Object.assign(ws, { binaryType: "blob" })

    if (ws.readyState === ws.OPEN) {
        const event = new Event("open")
        standard.onopen?.(event)
        standard.dispatchEvent(event)
    }

    ws.on("open", function onOpen() {
        const event = new Event("open")
        standard.onopen?.(event)
        standard.dispatchEvent(event)
    })

    ws.on("message", function onMessage(data: any, isBinary: boolean) {
        const event = new MessageEvent("message", { data: isBinary ? data : data.toString(), })
        standard.onmessage?.(event)
        standard.dispatchEvent(event)
    })

    ws.on("error", function onError(error: Error) {
        const event = new ErrorEvent(error, error.message)
        standard.onerror?.(event)
        standard.dispatchEvent(event)
    })

    ws.addEventListener("close", function onClose(ev: any) {
        const event = new (globalThis.CloseEvent ?? CloseEvent)("close", ev)
        standard.onclose?.(event)
        standard.dispatchEvent(event)
    })
}

export class ErrorEvent extends Event {
    constructor(readonly error: Error, readonly message: string) {
        super("error")
    }
}

export class CloseEvent extends Event implements globalThis.CloseEvent {
    readonly code: number
    readonly reason: string
    readonly wasClean: boolean

    constructor(type: string, eventInitDict: CloseEventInit) {
        super(type, eventInitDict)
        this.code = eventInitDict.code ?? 0
        this.reason = eventInitDict.reason ?? ""
        this.wasClean = eventInitDict.wasClean ?? false
    }
}

export function attach(standard: WebSocket, ws: ws.WebSocket): void {
    return attacher.attach?.(standard, ws)
}

interface CloseEventInit extends EventInit {
    code?: number
    reason?: string
    wasClean?: boolean
}

declare global {
    namespace App {
        interface Locals {
            isUpgradeRequest?: boolean
            upgradeWebSocket?: () => { socket: WebSocket, response: import("./response.js").UpgradeResponse }
        }
    }
}`
  writeFileSync(join(websocketDir, 'websocket.ts'), websocketContent)
  
  // Create dev-middleware.ts
  const devMiddlewareContent = `// Basic dev middleware for WebSocket support
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
}`
  writeFileSync(join(websocketDir, 'dev-middleware.ts'), devMiddlewareContent)
  
  // Create minimal stats.ts for build compatibility
  const statsContent = `import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

// Basic stats tracking
class WebSocketStatsManager {
  private connections = new Map<string, any>()
  private connectionCounter = 0
  
  registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string {
    const id = \`ws_\${++this.connectionCounter}_\${Date.now()}\`
    this.connections.set(id, { socket, wsSocket })
    return id
  }
  
  getConnectionCount(): number {
    return this.connections.size
  }
}

const statsManager = new WebSocketStatsManager()

export const WebSocketStats = {
  getConnectionCount: () => statsManager.getConnectionCount(),
  getConnectionStats: () => ({ totalConnections: statsManager.getConnectionCount() }),
  shutdown: () => {}
}

export function registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string {
  return statsManager.registerConnection(socket, wsSocket)
}`
  writeFileSync(join(websocketDir, 'stats.ts'), statsContent)
  
  // Create minimal connection-manager.ts for build compatibility
  const connectionManagerContent = `import type * as ws from "ws"
import type { WebSocket } from "./websocket.js"

// Basic connection manager
export class ConnectionManager {
  private connections = new Map<string, any>()
  
  registerConnection(socket: WebSocket, wsSocket: ws.WebSocket): string {
    const id = \`conn_\${Date.now()}\`
    this.connections.set(id, { socket, wsSocket })
    return id
  }
}

export const ConnectionManagerAPI = {
  getInstance: () => new ConnectionManager(),
  getStats: () => ({ totalConnections: 0 })
}`
  writeFileSync(join(websocketDir, 'connection-manager.ts'), connectionManagerContent)
  
  // Create minimal middleware/index.ts
  const middlewareContent = `import type { MiddlewareHandler } from 'astro'

export function createStatsMiddleware(): MiddlewareHandler {
  return async (_context, next) => {
    return next()
  }
}`
  writeFileSync(join(middlewareDir, 'index.ts'), middlewareContent)
  
  // Create minimal middleware/types.ts
  const middlewareTypesContent = `declare global {
  namespace App {
    interface Locals {
      websocketStats?: any
    }
  }
}

export {}`
  writeFileSync(join(middlewareDir, 'types.ts'), middlewareTypesContent)
  
  console.log('✅ All WebSocket files created from patch content')
}

export default applyNodeWebSocketPatch