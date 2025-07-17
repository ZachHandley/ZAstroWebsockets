#!/usr/bin/env node

/**
 * Dynamic Cloudflare WebSocket patch generator
 * Follows the 5-step process: copy upstream → modify local → update package.json → install deps → build
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export function applyCloudflareWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Cloudflare WebSocket patch by modifying upstream directly...')
  
  const upstreamCloudflareDir = join(astroUpstreamDir, 'packages/integrations/cloudflare')
  const finalCloudflareDir = join(rootDir, 'packages/cloudflare')
  
  try {
    // Step 1: Apply patch modifications directly to upstream
    console.log('🔧 Step 1: Applying patch modifications to upstream Cloudflare adapter')
    applyAllPatchModifications(upstreamCloudflareDir, rootDir)
    
    // Step 2: Update package.json in upstream (minimal changes only)
    console.log('📝 Step 2: Updating package.json in upstream adapter')
    updateUpstreamPackageJson(upstreamCloudflareDir)
    
    // Step 2.1: Install dependencies in upstream workspace (allow lockfile updates)
    console.log('📦 Step 2.1: Installing dependencies in upstream workspace')
    execSync('pnpm install --no-frozen-lockfile', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Step 3: Build in upstream workspace
    console.log('🏗️ Step 3: Building in upstream workspace')
    execSync('pnpm run build --filter @astrojs/cloudflare', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Step 4: Copy built dist folder to our final package
    console.log('📦 Step 4: Copying built dist to final package location')
    if (existsSync(finalCloudflareDir)) {
      rmSync(finalCloudflareDir, { recursive: true })
    }
    mkdirSync(finalCloudflareDir, { recursive: true })
    
    const upstreamDistDir = join(upstreamCloudflareDir, 'dist')
    const finalDistDir = join(finalCloudflareDir, 'dist')
    if (existsSync(upstreamDistDir)) {
      cpSync(upstreamDistDir, finalDistDir, { recursive: true })
      console.log('✅ Built dist folder copied successfully')
    }
    
    // Copy and modify upstream package.json for our package
    copyAndModifyUpstreamPackageJson(upstreamCloudflareDir, finalCloudflareDir)
    
    // Copy README.md to final package
    console.log('📄 Step 5: Copying README.md to final package')
    const readmePath = join(process.cwd(), 'README.md')
    const finalReadmePath = join(finalCloudflareDir, 'README.md')
    if (existsSync(readmePath)) {
      copyFileSync(readmePath, finalReadmePath)
      console.log('✅ Copied README.md to final package')
    } else {
      console.warn('⚠️ README.md not found in root directory')
    }
    
    console.log('✅ Cloudflare WebSocket patch applied successfully')
    
    // Return restore function to reset upstream changes
    return () => {
      console.log('🔄 Restoring upstream Cloudflare adapter to original state...')
      execSync('git checkout HEAD -- packages/integrations/cloudflare/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    }
    
  } catch (error) {
    // Restore upstream on error
    console.log('🔄 Restoring upstream due to error...')
    try {
      execSync('git checkout HEAD -- packages/integrations/cloudflare/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    } catch (restoreError) {
      console.warn('⚠️ Failed to restore upstream:', restoreError.message)
    }
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
    
    // Note: Type casting removed - using identical dependency versions from upstream
    // should eliminate type compatibility issues
    
    writeFileSync(indexPath, adapterContent)
  }
  
  // Note: handler.ts should already have @ts-expect-error for cloudflare:workers import
  // This import is runtime-only and the original file has the correct comment
  
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
    
    // Note: Explicit 'any' return type removed - proper ImageConfig types 
    // should be available with identical dependency versions
    
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
    
    // Fix lines 20-21: cast options.src to string when used
    imageServiceContent = imageServiceContent.replace(
      /} else if \(isRemoteAllowed\(options\.src, imageConfig\)\) \{/,
      '} else if (isRemoteAllowed(options.src, imageConfig)) {'
    )
    imageServiceContent = imageServiceContent.replace(
      /imageSource = options\.src;/g,
      'imageSource = String(options.src);'
    )
    
    writeFileSync(imageServicePath, imageServiceContent)
  }
  
  // Fix server.ts type compatibility issues
  const serverPath = join(localCloudflareDir, 'src/entrypoints/server.ts')
  if (existsSync(serverPath)) {
    let serverContent = readFileSync(serverPath, 'utf-8')
    
    // Note: SSRManifest type casting removed - identical dependency versions 
    // should ensure compatible SSRManifest types between App constructor and handle function
    
    writeFileSync(serverPath, serverContent)
  }
}

function updateUpstreamPackageJson(upstreamCloudflareDir: string): void {
  const packageJsonPath = join(upstreamCloudflareDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  
  // Only add the websocket export - keep everything else unchanged
  packageJson.exports['./websocket'] = './dist/websocket/index.js'
  
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
          const depPackageJsonPath = join(upstreamCloudflareDir, `../../${packageDir}/package.json`)
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
  console.log('✅ Updated upstream package.json with websocket export and resolved dependencies')
}

function copyAndModifyUpstreamPackageJson(upstreamCloudflareDir: string, finalCloudflareDir: string): void {
  // Read the upstream package.json (which already has our WebSocket export)
  const upstreamPackageJsonPath = join(upstreamCloudflareDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(upstreamPackageJsonPath, 'utf-8'))
  
  // Only modify what we need for our renamed package
  packageJson.name = 'zastro-websockets-cloudflare'
  packageJson.description = 'Deploy your site to Cloudflare Workers/Pages with WebSocket support'
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
          const depPackageJsonPath = join(upstreamCloudflareDir, `../../${packageDir}/package.json`)
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
  
  const packageJsonPath = join(finalCloudflareDir, 'package.json')
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('✅ Created final package.json for zastro-websockets-cloudflare based on upstream')
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
  private _readyState: number = 0 // Use numeric literal instead of static property
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
  readonly CONNECTING: 0 = 0
  readonly OPEN: 1 = 1
  readonly CLOSING: 2 = 2
  readonly CLOSED: 3 = 3

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

}

// WeakMap to store private Cloudflare WebSocket instances
const wsMap = new WeakMap<WebSocket, CloudflareWebSocket>()

export function attach(standard: WebSocket, cfWebSocket: CloudflareWebSocket): void {
  if (wsMap.has(standard)) {
    throw new Error('WebSocket already attached')
  }

  wsMap.set(standard, cfWebSocket)
  
  // Set private properties using Object.defineProperty for type safety
  Object.defineProperty(standard, '_ws', { value: cfWebSocket, writable: true })
  Object.defineProperty(standard, '_readyState', { value: WebSocket.OPEN, writable: true })

  // Set up event forwarding
  cfWebSocket.addEventListener('message', (event: { data: any }) => {
    const messageEvent = new MessageEvent('message', { data: event.data })
    standard.onmessage?.(messageEvent)
    standard.dispatchEvent(messageEvent)
  })

  cfWebSocket.addEventListener('close', (event: { code: number; reason: string; wasClean: boolean }) => {
    // Update readyState safely using Object.assign
    Object.assign(standard, { _readyState: WebSocket.CLOSED })
    const closeEvent = new CloseEvent('close', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    })
    standard.onclose?.(closeEvent)
    standard.dispatchEvent(closeEvent)
  })

  cfWebSocket.addEventListener('error', (_event: any) => {
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

// Cloudflare Workers type declarations
declare global {
  var WebSocketPair: {
    new (): {
      0: CloudflareWebSocket
      1: CloudflareWebSocket
    }
  }
  
  interface CloudflareWebSocket {
    send(data: string | ArrayBufferLike | ArrayBufferView): void
    close(code?: number, reason?: string): void
    accept(): void
    addEventListener(type: 'message', listener: (event: { data: any }) => void): void
    addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
    addEventListener(type: 'error', listener: (event: any) => void): void
    addEventListener(type: 'open', listener: (event: any) => void): void
    removeEventListener(type: string, listener: any): void
    readonly readyState: number
    readonly url: string
  }
}

// Extend ResponseInit to include Cloudflare's webSocket property
interface CloudflareResponseInit extends ResponseInit {
  webSocket?: CloudflareWebSocket
}

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
    const [client, server] = [webSocketPair[0], webSocketPair[1]]

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
    } as CloudflareResponseInit)

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

// Cloudflare Workers type declarations
declare global {
  var WebSocketPair: {
    new (): {
      0: CloudflareWebSocket
      1: CloudflareWebSocket
    }
  }
  
  interface CloudflareWebSocket {
    send(data: string | ArrayBufferLike | ArrayBufferView): void
    close(code?: number, reason?: string): void
    accept(): void
    addEventListener(type: 'message', listener: (event: { data: any }) => void): void
    addEventListener(type: 'close', listener: (event: { code: number; reason: string; wasClean: boolean }) => void): void
    addEventListener(type: 'error', listener: (event: any) => void): void
    addEventListener(type: 'open', listener: (event: any) => void): void
    removeEventListener(type: string, listener: any): void
    readonly readyState: number
    readonly url: string
  }
}

// Extend Request to include Cloudflare's cf property
interface CloudflareRequest extends Request {
  cf: any
}

// Extend ResponseInit to include Cloudflare's webSocket property
interface CloudflareResponseInit extends ResponseInit {
  webSocket?: CloudflareWebSocket
}

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
    const [client, server] = [webSocketPair[0], webSocketPair[1]]

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
          } as CloudflareResponseInit)

          return { socket, response: upgradeResponse }
        },
        runtime: {
          env,
          cf: (request as CloudflareRequest).cf,
          ctx,
          caches: globalThis.caches,
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
      } as CloudflareResponseInit)
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