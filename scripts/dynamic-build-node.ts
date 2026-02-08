#!/usr/bin/env node

/**
 * Dynamic Node.js WebSocket patch generator
 * Applies string replacements to upstream adapter + copies WebSocket source files
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveWorkspaceDeps, createFinalPackageJson } from '../src/shared/resolve-workspace-deps.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

export function applyNodeWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Node.js WebSocket patch...')

  const upstreamNodeDir = join(astroUpstreamDir, 'packages/integrations/node')
  const upstreamPackagesDir = join(astroUpstreamDir, 'packages')
  const finalNodeDir = join(rootDir, 'packages/node')

  if (!existsSync(upstreamNodeDir)) {
    throw new Error(`Upstream node directory not found: ${upstreamNodeDir}`)
  }

  try {
    // Step 1: Apply string replacements to upstream source files
    console.log('🔧 Step 1: Applying modifications to upstream Node adapter')
    const srcDir = join(upstreamNodeDir, 'src')
    applyServeAppModifications(srcDir)
    applyStandaloneModifications(srcDir)
    applyTypesModifications(srcDir)
    applyIndexModifications(srcDir)
    applyServerModifications(srcDir)

    // Step 2: Copy WebSocket source files into upstream
    console.log('📁 Step 2: Copying WebSocket source files')
    const websocketSrc = join(rootDir, 'src/node-websocket')
    const websocketDst = join(srcDir, 'websocket')
    const middlewareDst = join(srcDir, 'middleware')
    mkdirSync(websocketDst, { recursive: true })
    mkdirSync(middlewareDst, { recursive: true })
    cpSync(websocketSrc, websocketDst, { recursive: true })
    // Move middleware files to correct location
    if (existsSync(join(websocketDst, 'middleware'))) {
      cpSync(join(websocketDst, 'middleware'), middlewareDst, { recursive: true })
      rmSync(join(websocketDst, 'middleware'), { recursive: true })
    }

    // Step 3: Update upstream package.json (add WS exports + deps)
    console.log('📝 Step 3: Updating upstream package.json')
    updateUpstreamPackageJson(upstreamNodeDir)

    // Step 3.1: Resolve workspace deps for build
    console.log('📦 Step 3.1: Resolving workspace dependencies')
    resolveWorkspaceDeps(join(upstreamNodeDir, 'package.json'), upstreamPackagesDir)

    // Step 3.2: Install dependencies
    console.log('📦 Step 3.2: Installing dependencies in upstream workspace')
    execSync('pnpm install --no-frozen-lockfile', { cwd: astroUpstreamDir, stdio: 'inherit' })

    // Step 4: Build
    console.log('🏗️ Step 4: Building in upstream workspace')
    execSync('pnpm run build --filter @astrojs/node', { cwd: astroUpstreamDir, stdio: 'inherit' })

    // Step 5: Copy built dist to final package
    console.log('📦 Step 5: Copying built dist to final package')
    if (existsSync(finalNodeDir)) {
      rmSync(finalNodeDir, { recursive: true })
    }
    mkdirSync(finalNodeDir, { recursive: true })

    const upstreamDistDir = join(upstreamNodeDir, 'dist')
    if (existsSync(upstreamDistDir)) {
      cpSync(upstreamDistDir, join(finalNodeDir, 'dist'), { recursive: true })
    }

    // Create final package.json
    createFinalPackageJson(
      join(upstreamNodeDir, 'package.json'),
      join(finalNodeDir, 'package.json'),
      upstreamPackagesDir,
      {
        name: 'zastro-websockets-node',
        description: 'Deploy your site to a Node.js server with WebSocket support',
      }
    )

    // Copy README
    const readmePath = join(rootDir, 'README.md')
    if (existsSync(readmePath)) {
      copyFileSync(readmePath, join(finalNodeDir, 'README.md'))
    }

    console.log('✅ Node.js WebSocket patch applied successfully')

    return () => {
      console.log('🔄 Restoring upstream Node adapter...')
      execSync('git checkout HEAD -- packages/integrations/node/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    }

  } catch (error: any) {
    console.log('🔄 Restoring upstream due to error...')
    try {
      execSync('git checkout HEAD -- packages/integrations/node/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    } catch (restoreError: any) {
      console.warn('⚠️ Failed to restore upstream:', restoreError.message)
    }
    console.error('❌ Error applying Node.js WebSocket patch:', error.message)
    throw error
  }
}

// --- String replacements for upstream files ---

function applyServeAppModifications(srcDir: string) {
  const filePath = join(srcDir, 'serve-app.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  // Add default value for locals parameter
  content = content.replace(
    /return async \(req, res, next, locals\) => {/,
    'return async (req, res, next, locals = {}) => {'
  )

  // Add WebSocket upgrade locals before routeData
  if (!content.includes('isUpgradeRequest: false')) {
    content = content.replace(
      /(\s+)const routeData = app\.match\(request\);/,
      `$1Object.assign(locals, {
			isUpgradeRequest: false,
			upgradeWebSocket() {
				throw new Error("The request must be an upgrade request to upgrade the connection to a WebSocket.")
			}
		})
$1const routeData = app.match(request);`
    )
  }

  writeFileSync(filePath, content)
}

function applyStandaloneModifications(srcDir: string) {
  const filePath = join(srcDir, 'standalone.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  if (!content.includes('createWebsocketHandler')) {
    content = content.replace(
      /import { createStaticHandler } from '\.\/serve-static\.js';/,
      `import { createStaticHandler } from './serve-static.js';
import { createWebsocketHandler } from "./websocket/serve-websocket.js";`
    )
  }

  if (!content.includes('server.server.on("upgrade"')) {
    content = content.replace(
      /const server = createServer\(handler, host, port\);/,
      `const server = createServer(handler, host, port);
	server.server.on("upgrade", createWebsocketHandler(app))`
    )
  }

  writeFileSync(filePath, content)
}

function applyTypesModifications(srcDir: string) {
  const filePath = join(srcDir, 'types.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  content = content.replace(
    /type RequestHandlerParams = \[/,
    'export type RequestHandlerParams = ['
  )
  content = content.replace(
    /locals\?: object,/,
    'locals?: { [key: string]: any },'
  )

  writeFileSync(filePath, content)
}

function applyIndexModifications(srcDir: string) {
  const filePath = join(srcDir, 'index.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  const packageName = 'zastro-websockets-node'

  // Add WebSocket middleware import
  if (!content.includes('websocket/dev-middleware.js')) {
    content = content.replace(
      /import type { AstroAdapter/,
      `import { onRequest } from './websocket/dev-middleware.js'
import type { AstroAdapter`
    )
  }

  // Add Locals interface
  if (!content.includes('interface Locals')) {
    const interfaceCode = `
declare global {
	namespace App {
		interface Locals {
			isUpgradeRequest?: boolean
			upgradeWebSocket?: () => { socket: import('./websocket/websocket.js').WebSocket, response: import('./websocket/response.js').UpgradeResponse }
		}
	}
}
`
    content = content.replace(
      /export default function createIntegration/,
      interfaceCode + '\nexport default function createIntegration'
    )
  }

  // Replace package references
  content = content.replace(/name: '@astrojs\/node'/g, `name: '${packageName}'`)
  content = content.replace(/serverEntrypoint: '@astrojs\/node\/server\.js'/g, `serverEntrypoint: '${packageName}/server.js'`)
  content = content.replace(/previewEntrypoint: '@astrojs\/node\/preview\.js'/g, `previewEntrypoint: '${packageName}/preview.js'`)

  // Add middleware setup
  if (!content.includes('addMiddleware')) {
    content = content.replace(
      /'astro:config:setup': async \(\{ updateConfig, config, logger \}\) => \{/,
      `'astro:config:setup': async ({ updateConfig, config, logger, addMiddleware }) => {
				addMiddleware({
					entrypoint: '${packageName}/websocket/dev-middleware.js',
					order: 'pre'
				});`
    )
  }

  writeFileSync(filePath, content)
}

function applyServerModifications(srcDir: string) {
  const filePath = join(srcDir, 'server.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  if (!content.includes('createWebsocketHandler')) {
    content = content.replace(
      `import startServer, { createStandaloneHandler } from './standalone.js';`,
      `import startServer, { createStandaloneHandler } from './standalone.js';
import { createWebsocketHandler } from './websocket/serve-websocket.js';`
    )
  }

  if (!content.includes('websocketHandler')) {
    content = content.replace(
      /return\s*{\s*options:\s*options,\s*handler:\s*options\.mode\s*===\s*['"]middleware['"][\s\S]*?startServer:\s*\(\)\s*=>\s*startServer\(app,\s*options\),?\s*};/s,
      `return {
		options: options,
		handler: options.mode === 'middleware' ? createMiddleware(app) : createStandaloneHandler(app, options),
		startServer: () => startServer(app, options),
		websocketHandler: createWebsocketHandler(app)
	};`
    )
  }

  writeFileSync(filePath, content)
  console.log('✅ Added WebSocket support to server.ts')
}

// --- Package.json updates ---

function updateUpstreamPackageJson(upstreamNodeDir: string): void {
  const packageJsonPath = join(upstreamNodeDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

  // Add websocket exports
  if (!packageJson.exports) packageJson.exports = {}
  packageJson.exports['./stats'] = './dist/websocket/stats.js'
  packageJson.exports['./websocket'] = './dist/websocket/index.js'
  packageJson.exports['./websocket/dev-middleware.js'] = './dist/websocket/dev-middleware.js'
  packageJson.exports['./websocket/websocket.js'] = './dist/websocket/websocket.js'
  packageJson.exports['./websocket/response.js'] = './dist/websocket/response.js'
  packageJson.exports['./websocket/serve-websocket.js'] = './dist/websocket/serve-websocket.js'
  packageJson.exports['./websocket/attach.js'] = './dist/websocket/attach.js'
  packageJson.exports['./websocket/stats.js'] = './dist/websocket/stats.js'

  // Add WebSocket dependencies
  if (!packageJson.dependencies) packageJson.dependencies = {}
  packageJson.dependencies.ws = '^8.18.0'

  if (!packageJson.devDependencies) packageJson.devDependencies = {}
  packageJson.devDependencies['@types/ws'] = '^8.5.12'

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('✅ Updated upstream package.json with websocket exports')
}

export default applyNodeWebSocketPatch
