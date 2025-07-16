#!/usr/bin/env node

/**
 * Dynamic Cloudflare WebSocket patch generator
 * Follows the 5-step process: copy upstream → modify local → update package.json → install deps → build
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export function applyCloudflareWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Cloudflare WebSocket patch using 5-step process...')
  
  const upstreamCloudflareDir = join(astroUpstreamDir, 'packages/integrations/cloudflare')
  const localCloudflareDir = join(rootDir, 'packages/cloudflare')
  
  try {
    // Step 1: Copy upstream files to packages/cloudflare/
    console.log('📁 Step 1: Copying upstream files to packages/cloudflare/')
    if (existsSync(localCloudflareDir)) {
      rmSync(localCloudflareDir, { recursive: true })
    }
    cpSync(upstreamCloudflareDir, localCloudflareDir, { recursive: true })
    
    // Step 2: Apply patch modifications to the local copy
    console.log('🔧 Step 2: Applying patch modifications to local copy')
    applyAllPatchModifications(localCloudflareDir, rootDir)
    
    // Import paths should work with package exports - no fixes needed
    
    // Step 3: Update package.json in the local copy
    console.log('📝 Step 3: Updating package.json in local copy')
    updateLocalPackageJson(localCloudflareDir, rootDir)
    
    // Step 4: Install dependencies in the local copy
    console.log('📦 Step 4: Installing dependencies in local copy')
    execSync('pnpm install', { cwd: localCloudflareDir, stdio: 'inherit' })
    
    // Step 4.1: Link internal-helpers from astro-upstream manually
    console.log('🔗 Linking @astrojs/internal-helpers from astro-upstream...')
    const internalHelpersSource = join(rootDir, 'astro-upstream/packages/internal-helpers')
    const internalHelpersTarget = join(localCloudflareDir, 'node_modules/@astrojs/internal-helpers')
    if (existsSync(internalHelpersSource)) {
      mkdirSync(join(localCloudflareDir, 'node_modules/@astrojs'), { recursive: true })
      // Remove existing symlink/folder first
      if (existsSync(internalHelpersTarget)) {
        rmSync(internalHelpersTarget, { recursive: true, force: true })
      }
      cpSync(internalHelpersSource, internalHelpersTarget, { recursive: true })
      console.log('✅ @astrojs/internal-helpers linked successfully')
    }
    
    // Step 4.2: Link underscore-redirects from astro-upstream manually
    console.log('🔗 Linking @astrojs/underscore-redirects from astro-upstream...')
    const underscoreRedirectsSource = join(rootDir, 'astro-upstream/packages/underscore-redirects')
    const underscoreRedirectsTarget = join(localCloudflareDir, 'node_modules/@astrojs/underscore-redirects')
    if (existsSync(underscoreRedirectsSource)) {
      // Remove existing symlink/folder first
      if (existsSync(underscoreRedirectsTarget)) {
        rmSync(underscoreRedirectsTarget, { recursive: true, force: true })
      }
      cpSync(underscoreRedirectsSource, underscoreRedirectsTarget, { recursive: true })
      console.log('✅ @astrojs/underscore-redirects linked successfully')
    }
    
    // Step 5: Build in the local copy
    console.log('🏗️ Step 5: Building in local copy')
    execSync('pnpm run build', { cwd: localCloudflareDir, stdio: 'inherit' })
    
    console.log('✅ Cloudflare WebSocket patch applied successfully')
    
    // Return empty restore function since we're not modifying upstream
    return () => {}
    
  } catch (error) {
    console.error('❌ Error applying Cloudflare WebSocket patch:', error.message)
    throw error
  }
}

/**
 * Fix @astrojs/internal-helpers import paths in all TypeScript files
 */
function fixInternalHelpersImports(localCloudflareDir: string) {
  const findTsFiles = (dir: string): string[] => {
    const files: string[] = []
    const entries = readdirSync(dir)
    
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        files.push(...findTsFiles(fullPath))
      } else if (entry.endsWith('.ts')) {
        files.push(fullPath)
      }
    }
    
    return files
  }
  
  const srcDir = join(localCloudflareDir, 'src')
  if (!existsSync(srcDir)) return
  
  const tsFiles = findTsFiles(srcDir)
  
  tsFiles.forEach((fullPath: string) => {
    let content = readFileSync(fullPath, 'utf-8')
    let modified = false
    
    // Fix fs imports
    if (content.includes("from '@astrojs/internal-helpers/fs'")) {
      content = content.replace(
        /from '@astrojs\/internal-helpers\/fs'/g,
        "from '@astrojs/internal-helpers/dist/fs.js'"
      )
      modified = true
    }
    
    // Fix path imports  
    if (content.includes("from '@astrojs/internal-helpers/path'")) {
      content = content.replace(
        /from '@astrojs\/internal-helpers\/path'/g,
        "from '@astrojs/internal-helpers/dist/path.js'"
      )
      modified = true
    }
    
    if (modified) {
      writeFileSync(fullPath, content)
      const relativePath = fullPath.replace(localCloudflareDir + '/', '')
      console.log(`  ✅ Fixed internal-helpers imports in ${relativePath}`)
    }
  })
}

function applyAllPatchModifications(localCloudflareDir: string, rootDir: string): void {
  // Create websocket directory
  const websocketDir = join(localCloudflareDir, 'src/websocket')
  mkdirSync(websocketDir, { recursive: true })
  
  // Create all WebSocket implementation files directly from patch content
  createCloudflareWebSocketFiles(websocketDir)
  
  // Update the main adapter file with package name changes
  const indexPath = join(localCloudflareDir, 'src/index.ts')
  if (existsSync(indexPath)) {
    let adapterContent = readFileSync(indexPath, 'utf-8')
    
    // Replace package name references
    adapterContent = adapterContent.replace(
      /name: '@astrojs\/cloudflare'/g,
      "name: 'zastro-websockets-cloudflare'"
    )
    adapterContent = adapterContent.replace(
      /'@astrojs\/cloudflare\/entrypoints\//g,
      "'zastro-websockets-cloudflare/entrypoints/"
    )
    adapterContent = adapterContent.replace(
      /"@astrojs\/cloudflare\/entrypoints\//g,
      '"zastro-websockets-cloudflare/entrypoints/'
    )
    adapterContent = adapterContent.replace(
      /serverEntrypoint: '@astrojs\/cloudflare\/entrypoints\/server\.js'/g,
      "serverEntrypoint: 'zastro-websockets-cloudflare/entrypoints/server.js'"
    )
    
    // Add type casting to fix compatibility issues
    adapterContent = adapterContent.replace(
      /cloudflareModulePlugin,/g,
      'cloudflareModulePlugin as any,'
    )
    
    adapterContent = adapterContent.replace(
      /_config = config;/g,
      '_config = config as any;'
    )
    
    writeFileSync(indexPath, adapterContent)
  }
  
  // Fix handler.ts @ts-expect-error issue
  const handlerPath = join(localCloudflareDir, 'src/utils/handler.ts')
  if (existsSync(handlerPath)) {
    let handlerContent = readFileSync(handlerPath, 'utf-8')
    
    // Remove unused @ts-expect-error directive
    handlerContent = handlerContent.replace(
      /\/\/ @ts-expect-error - It is safe to expect the error here\.\n/g,
      ''
    )
    
    writeFileSync(handlerPath, handlerContent)
  }
  
  // Fix image-config.ts package references and type issues
  const imageConfigPath = join(localCloudflareDir, 'src/utils/image-config.ts')
  if (existsSync(imageConfigPath)) {
    let imageConfigContent = readFileSync(imageConfigPath, 'utf-8')
    
    // Update image service entrypoint references
    imageConfigContent = imageConfigContent.replace(
      /'@astrojs\/cloudflare\/image-service'/g,
      "'zastro-websockets-cloudflare/image-service'"
    )
    imageConfigContent = imageConfigContent.replace(
      /'@astrojs\/cloudflare\/image-endpoint'/g,
      "'zastro-websockets-cloudflare/image-endpoint'"
    )
    
    // Fix type annotation issue by adding explicit return type
    imageConfigContent = imageConfigContent.replace(
      /export function setImageConfig\(/,
      'export function setImageConfig('
    )
    
    // Add explicit return type to fix the inferred type issue
    imageConfigContent = imageConfigContent.replace(
      /\) \{/,
      '): any {'
    )
    
    writeFileSync(imageConfigPath, imageConfigContent)
  }
  
  // Fix image-service.ts type compatibility
  const imageServicePath = join(localCloudflareDir, 'src/entrypoints/image-service.ts')
  if (existsSync(imageServicePath)) {
    let imageServiceContent = readFileSync(imageServicePath, 'utf-8')
    
    // Fix getURL return type by ensuring it always returns string
    imageServiceContent = imageServiceContent.replace(
      /getURL: \(options, imageConfig\) => \{/,
      'getURL: (options, imageConfig): string => {'
    )
    
    // Ensure all return paths return strings
    imageServiceContent = imageServiceContent.replace(
      /return options\.src;/g,
      'return String(options.src);'
    )
    
    writeFileSync(imageServicePath, imageServiceContent)
  }
  
  // Fix server.ts type compatibility issues
  const serverPath = join(localCloudflareDir, 'src/entrypoints/server.ts')
  if (existsSync(serverPath)) {
    let serverContent = readFileSync(serverPath, 'utf-8')
    
    // Add type casting to fix SSRManifest compatibility
    serverContent = serverContent.replace(
      /const app = new App\(manifest\);/,
      'const app = new App(manifest as any);'
    )
    
    // Also fix the handle function call with type casting
    serverContent = serverContent.replace(
      /return await handle\(manifest, app, request, env, context\);/,
      'return await handle(manifest as any, app, request, env, context);'
    )
    
    writeFileSync(serverPath, serverContent)
  }
}

function updateLocalPackageJson(localCloudflareDir: string, rootDir: string): void {
  const packageJsonPath = join(localCloudflareDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Update package name
  packageJson.name = 'zastro-websockets-cloudflare'
  
  // Add websocket export to match patch exactly
  if (!packageJson.exports) {
    packageJson.exports = {}
  }
  
  // Ensure the websocket export is added as per the patch
  packageJson.exports['./websocket'] = './dist/websocket/index.js'
  
  // Convert workspace dependencies to regular dependency versions using upstream versions
  if (packageJson.dependencies) {
    if (packageJson.dependencies['@astrojs/internal-helpers']) {
      const internalHelpersVersion = JSON.parse(
        readFileSync(join(rootDir, 'astro-upstream/packages/internal-helpers/package.json'), 'utf-8')
      ).version
      packageJson.dependencies['@astrojs/internal-helpers'] = `^${internalHelpersVersion}`
    }
    if (packageJson.dependencies['@astrojs/underscore-redirects']) {
      const underscoreRedirectsVersion = JSON.parse(
        readFileSync(join(rootDir, 'astro-upstream/packages/underscore-redirects/package.json'), 'utf-8')
      ).version
      packageJson.dependencies['@astrojs/underscore-redirects'] = `^${underscoreRedirectsVersion}`
    }
  }
  
  if (packageJson.devDependencies) {
    delete packageJson.devDependencies['astro']
    delete packageJson.devDependencies['astro-scripts']
  }
  
  // Update build scripts to not use astro-scripts
  if (packageJson.scripts) {
    packageJson.scripts.build = 'tsc'
    packageJson.scripts.dev = 'tsc --watch'
    delete packageJson.scripts['build:ci']
    delete packageJson.scripts.test
  }
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  
  // Create a proper tsconfig.json for standalone build
  const tsconfigPath = join(localCloudflareDir, 'tsconfig.json')
  const tsconfig = {
    compilerOptions: {
      target: 'ES2021',
      lib: ['ES2021', 'WebWorker'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      types: ['@cloudflare/workers-types'],
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitAny: false
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'test']
  }
  
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n')
}

function createCloudflareWebSocketFiles(websocketDir: string): void {
  // Create websocket/index.ts - barrel export
  const indexContent = `/**
 * Cloudflare WebSocket exports
 */

export { WebSocket, attach, ErrorEvent, CloseEvent } from './websocket.js'
export { onRequest } from './middleware.js'
export { createWebSocketHandler } from './server.js'
`
  writeFileSync(join(websocketDir, 'index.ts'), indexContent)
  
  // Create websocket/websocket.ts - core WebSocket implementation
  const websocketContent = `/**
 * Cloudflare WebSocket implementation
 */

export interface WebSocketUpgrade {
  socket: WebSocket
  response: Response
}

export class WebSocket extends EventTarget {
  private _ws: CloudflareWebSocket | undefined
  private _readyState: number = WebSocket.CONNECTING
  private _binaryType: 'blob' | 'arraybuffer' = 'blob'
  private _url: string = ''
  private _protocol: string = ''
  private _extensions: string = ''
  private _bufferedAmount: number = 0

  static readonly CONNECTING = 0 as const
  static readonly OPEN       = 1 as const
  static readonly CLOSING    = 2 as const
  static readonly CLOSED     = 3 as const

  // Instance constants
  declare readonly CONNECTING: 0
  declare readonly OPEN      : 1
  declare readonly CLOSING   : 2
  declare readonly CLOSED    : 3

  // Event handlers
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url?: string) {
    super()
    this._url = url || ''
  }

  get url() {
    return this._url
  }

  get readyState() {
    return this._readyState
  }

  get bufferedAmount() {
    return this._bufferedAmount
  }

  get extensions() {
    return this._extensions
  }

  get protocol() {
    return this._protocol
  }

  get binaryType() {
    return this._binaryType
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this._binaryType = value
  }

  close(code?: number, reason?: string) {
    if (this._readyState === WebSocket.CLOSED || this._readyState === WebSocket.CLOSING) {
      return
    }

    this._readyState = WebSocket.CLOSING

    if (this._ws) {
      this._ws.close(code, reason)
    } else {
      // Close immediately if not attached
      this._readyState = WebSocket.CLOSED
      const event = new CloseEvent('close', { code: code || 1000, reason: reason || '', wasClean: true })
      this.onclose?.(event)
      this.dispatchEvent(event)
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this._readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }

    if (this._ws) {
      if (data instanceof Blob) {
        // Convert blob to array buffer for Cloudflare
        data.arrayBuffer().then(buffer => this._ws!.send(buffer))
      } else {
        this._ws.send(data)
      }
    }
  }

  static {
    Object.assign(this.prototype, {
      CONNECTING: 0,
      OPEN      : 1,
      CLOSING   : 2,
      CLOSED    : 3
    })

    // Freeze the prototype and class to align with the spec
    Object.freeze(this.prototype)
    Object.freeze(this)
  }
}

// WeakMap to store private Cloudflare WebSocket instances
const wsMap = new WeakMap<WebSocket, CloudflareWebSocket>()

export function attach(standard: WebSocket, cfWebSocket: CloudflareWebSocket): void {
  if (wsMap.has(standard)) {
    throw new Error('WebSocket already attached')
  }

  wsMap.set(standard, cfWebSocket)
  ;(standard as any)._ws = cfWebSocket
  ;(standard as any)._readyState = WebSocket.OPEN

  // Set up event forwarding
  cfWebSocket.addEventListener('message', (event: { data: any }) => {
    const messageEvent = new MessageEvent('message', { data: event.data })
    standard.onmessage?.(messageEvent)
    standard.dispatchEvent(messageEvent)
  })

  cfWebSocket.addEventListener('close', (event: { code: number; reason: string; wasClean: boolean }) => {
    ;(standard as any)._readyState = WebSocket.CLOSED
    const closeEvent = new CloseEvent('close', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    })
    standard.onclose?.(closeEvent)
    standard.dispatchEvent(closeEvent)
  })

  cfWebSocket.addEventListener('error', (event: any) => {
    const errorEvent = new ErrorEvent('error', { message: 'WebSocket error' })
    standard.onerror?.(errorEvent)
    standard.dispatchEvent(errorEvent)
  })

  // Dispatch open event
  const openEvent = new Event('open')
  standard.onopen?.(openEvent)
  standard.dispatchEvent(openEvent)
}

export class ErrorEvent extends Event {
  constructor(type: string, init?: { message?: string }) {
    super(type)
    this.message = init?.message || ''
  }

  readonly message: string
}

export class CloseEvent extends Event implements globalThis.CloseEvent {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean

  constructor(type: string, eventInitDict?: CloseEventInit) {
    super(type, eventInitDict)
    this.code = eventInitDict?.code ?? 0
    this.reason = eventInitDict?.reason ?? ''
    this.wasClean = eventInitDict?.wasClean ?? false
  }
}

interface CloseEventInit extends EventInit {
  code?: number
  reason?: string
  wasClean?: boolean
}

// Cloudflare WebSocket types - use the types from @cloudflare/workers-types
interface CloudflareWebSocket {
  send(data: string | ArrayBufferLike | ArrayBufferView): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'message', listener: (event: { data: any }) => void): void
  addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
  addEventListener(type: 'error', listener: (event: any) => void): void
  addEventListener(type: 'open', listener: (event: any) => void): void
  removeEventListener(type: string, listener: any): void
  readonly readyState: number
  readonly url: string
  accept(): void
}
`
  writeFileSync(join(websocketDir, 'websocket.ts'), websocketContent)
  
  // Create websocket/middleware.ts - CloudFlare middleware
  const middlewareContent = `/**
 * Cloudflare WebSocket middleware
 */

import { WebSocket, attach } from './websocket.js'

export interface CloudflareLocals {
  isUpgradeRequest: boolean
  upgradeWebSocket(): { socket: WebSocket, response: Response }
  runtime?: {
    env: any
    cf: any
    ctx: any
    caches: any
    waitUntil: (promise: Promise<any>) => void
  }
}

export const onRequest = async function cloudflareWebSocketMiddleware(
  context: any,
  next: () => Promise<Response>
): Promise<Response> {
  const { request, locals } = context

  // Check if this is a WebSocket upgrade request
  const isUpgradeRequest =
    request.headers.get('upgrade') === 'websocket' &&
    request.headers.get('connection')?.toLowerCase().includes('upgrade')

  // Set up locals for WebSocket support
  locals.isUpgradeRequest = isUpgradeRequest
  locals.upgradeWebSocket = () => {
    if (!isUpgradeRequest) {
      throw new Error('The request must be an upgrade request to upgrade the connection to a WebSocket.')
    }

    // Create WebSocket pair for Cloudflare
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Create our WebSocket wrapper
    const socket = new WebSocket(request.url)

    // Attach the server-side WebSocket to our wrapper
    attach(socket, server)

    // Return WebSocket upgrade response
    const response = new Response(null, {
      status: 101,
      statusText: 'Switching Protocols',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
      webSocket: client,
    })

    return { socket, response }
  }

  return next()
}
`
  writeFileSync(join(websocketDir, 'middleware.ts'), middlewareContent)
  
  // Create websocket/server.ts - WebSocket server handler
  const serverContent = `/**
 * Cloudflare WebSocket server entrypoint
 */

import type { App } from 'astro/app'
import { WebSocket, attach } from './websocket.js'

export type CloudflareApp = App

export function createWebSocketHandler(app: CloudflareApp) {
  return async function handleWebSocket(request: Request, env: any, ctx: any) {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('upgrade')
    const connectionHeader = request.headers.get('connection')

    if (upgradeHeader !== 'websocket' || !connectionHeader?.toLowerCase().includes('upgrade')) {
      // Not a WebSocket upgrade request, handle normally
      return app.render(request, { locals: { isUpgradeRequest: false } })
    }

    // Create WebSocket pair for Cloudflare
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Render the Astro page with WebSocket support
    const response = await app.render(request, {
      locals: {
        isUpgradeRequest: true,
        upgradeWebSocket() {
          // Create our WebSocket wrapper
          const socket = new WebSocket(request.url)

          // Attach the server-side WebSocket to our wrapper
          attach(socket, server)

          // Return WebSocket upgrade response
          const upgradeResponse = new Response(null, {
            status: 101,
            statusText: 'Switching Protocols',
            headers: {
              'Upgrade': 'websocket',
              'Connection': 'Upgrade',
            },
            webSocket: client,
          })

          return { socket, response: upgradeResponse }
        },
        runtime: {
          env,
          cf: request.cf,
          ctx,
          caches: (globalThis as any).caches,
          waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
        },
      },
    })

    // If the response is a WebSocket upgrade response, accept the connection
    if (response.status === 101 && response.headers.get('upgrade') === 'websocket') {
      // Accept the WebSocket connection
      server.accept()

      // Return the response with the client WebSocket
      return new Response(null, {
        status: 101,
        statusText: 'Switching Protocols',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
        },
        webSocket: client,
      })
    }

    return response
  }
}

// Re-export WebSocket types for convenience
export { WebSocket, attach } from './websocket.js'
`
  writeFileSync(join(websocketDir, 'server.ts'), serverContent)
  
  console.log('✅ Created all CloudFlare WebSocket implementation files')
}

export default applyCloudflareWebSocketPatch