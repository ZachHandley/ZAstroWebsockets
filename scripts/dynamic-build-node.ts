#!/usr/bin/env node

/**
 * Dynamic Node.js WebSocket patch generator
 * Follows the 5-step process: copy upstream → modify local → update package.json → install deps → build
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export function applyNodeWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Node.js WebSocket patch using 5-step process...')
  
  const upstreamNodeDir = join(astroUpstreamDir, 'packages/integrations/node')
  const localNodeDir = join(rootDir, 'packages/node')
  
  if (!existsSync(upstreamNodeDir)) {
    throw new Error(`Upstream node directory not found: ${upstreamNodeDir}`)
  }
  
  try {
    // Step 1: Copy upstream files to packages/node/
    console.log('📁 Step 1: Copying upstream files to packages/node/')
    if (existsSync(localNodeDir)) {
      rmSync(localNodeDir, { recursive: true, force: true })
    }
    mkdirSync(localNodeDir, { recursive: true })
    cpSync(upstreamNodeDir, localNodeDir, { recursive: true })
    
    // Step 2: Apply patch modifications to the local copy
    console.log('🔧 Step 2: Applying patch modifications to local copy')
    applyAllPatchModifications(localNodeDir)
    
    // Step 3: Update package.json in the local copy
    console.log('📝 Step 3: Updating package.json in local copy')
    updateLocalPackageJson(localNodeDir, rootDir)
    
    // Step 4: Install dependencies in the local copy
    console.log('📦 Step 4: Installing dependencies in local copy')
    execSync('pnpm install', { cwd: localNodeDir, stdio: 'inherit' })
    
    // Step 4.1: Link internal-helpers from astro-upstream manually
    console.log('🔗 Linking @astrojs/internal-helpers from astro-upstream...')
    const internalHelpersSource = join(rootDir, 'astro-upstream/packages/internal-helpers')
    const internalHelpersTarget = join(localNodeDir, 'node_modules/@astrojs/internal-helpers')
    if (existsSync(internalHelpersSource)) {
      mkdirSync(join(localNodeDir, 'node_modules/@astrojs'), { recursive: true })
      // Remove existing symlink/folder first
      if (existsSync(internalHelpersTarget)) {
        rmSync(internalHelpersTarget, { recursive: true, force: true })
      }
      cpSync(internalHelpersSource, internalHelpersTarget, { recursive: true })
      console.log('✅ @astrojs/internal-helpers linked successfully')
    }
    
    // Step 5: Build in the local copy
    console.log('🏗️ Step 5: Building in local copy')
    execSync('pnpm run build', { cwd: localNodeDir, stdio: 'inherit' })
    
    console.log('✅ Node.js WebSocket patch applied successfully')
    
    // Return empty restore function since we're not modifying upstream
    return () => {}
    
  } catch (error) {
    console.error('❌ Error applying Node.js WebSocket patch:', error.message)
    throw error
  }
}

/**
 * Apply all patch modifications to the local copy
 */
function applyAllPatchModifications(localNodeDir: string) {
  const srcDir = join(localNodeDir, 'src')
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
 * Update package.json in the local copy
 */
function updateLocalPackageJson(localNodeDir: string, rootDir: string) {
  const packageJsonPath = join(localNodeDir, 'package.json')
  
  // Start with upstream package.json as base to ensure identical dependency versions
  const upstreamPackageJsonPath = join(rootDir, 'astro-upstream/packages/integrations/node/package.json')
  const packageJson = JSON.parse(readFileSync(upstreamPackageJsonPath, 'utf-8'))
  
  // Only modify what we specifically need for our WebSocket-enabled version
  packageJson.name = 'zastro-websockets-node'
  
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
  
  // Convert workspace dependencies to actual versions for standalone build
  if (packageJson.dependencies) {
    if (packageJson.dependencies['@astrojs/internal-helpers'] === 'workspace:*') {
      const internalHelpersVersion = JSON.parse(
        readFileSync(join(rootDir, 'astro-upstream/packages/internal-helpers/package.json'), 'utf-8')
      ).version
      packageJson.dependencies['@astrojs/internal-helpers'] = `^${internalHelpersVersion}`
    }
  }
  
  // Remove workspace-specific devDependencies
  if (packageJson.devDependencies) {
    if (packageJson.devDependencies['astro'] === 'workspace:*') {
      delete packageJson.devDependencies['astro']
    }
    if (packageJson.devDependencies['astro-scripts'] === 'workspace:*') {
      delete packageJson.devDependencies['astro-scripts']
    }
  }
  
  // Update build scripts to use tsc instead of astro-scripts
  if (packageJson.scripts) {
    packageJson.scripts.build = 'tsc'
    packageJson.scripts.dev = 'tsc --watch'
    delete packageJson.scripts['build:ci']
    delete packageJson.scripts.test
  }
  
  // Add websocket exports to match the package structure
  packageJson.exports['./websocket/stats'] = {
    types: './dist/websocket/stats.d.ts',
    import: './dist/websocket/stats.js'
  }
  packageJson.exports['./stats'] = {
    types: './dist/websocket/stats.d.ts',
    import: './dist/websocket/stats.js'
  }
  packageJson.exports['./websocket/connection-manager'] = {
    types: './dist/websocket/connection-manager.d.ts',
    import: './dist/websocket/connection-manager.js'
  }
  packageJson.exports['./connection-manager'] = {
    types: './dist/websocket/connection-manager.d.ts',
    import: './dist/websocket/connection-manager.js'
  }
  packageJson.exports['./middleware'] = {
    types: './dist/middleware/index.d.ts',
    import: './dist/middleware/index.js'
  }
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  
  // Create a proper tsconfig.json for standalone build
  const tsconfigPath = join(localNodeDir, 'tsconfig.json')
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      types: ['node']
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'test']
  }
  
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n')
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