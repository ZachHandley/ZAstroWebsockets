#!/usr/bin/env node

/**
 * Dynamic Cloudflare WebSocket patch generator
 * Applies string replacements to upstream adapter + copies WebSocket source files
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveWorkspaceDeps, createFinalPackageJson } from '../src/shared/resolve-workspace-deps.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

export function applyCloudflareWebSocketPatch(astroUpstreamDir: string, rootDir: string): () => void {
  console.log('🔧 Applying Cloudflare WebSocket patch...')

  const upstreamCloudflareDir = join(astroUpstreamDir, 'packages/integrations/cloudflare')
  const upstreamPackagesDir = join(astroUpstreamDir, 'packages')
  const finalCloudflareDir = join(rootDir, 'packages/cloudflare')

  try {
    // Step 1: Apply string replacements to upstream source files
    console.log('🔧 Step 1: Applying modifications to upstream Cloudflare adapter')
    applyImageConfigModifications(upstreamCloudflareDir)
    applyIndexModifications(upstreamCloudflareDir)

    // Step 2: Copy WebSocket source files into upstream
    console.log('📁 Step 2: Copying WebSocket source files')
    const websocketSrc = join(rootDir, 'src/cloudflare-websocket')
    const websocketDst = join(upstreamCloudflareDir, 'src/websocket')
    mkdirSync(websocketDst, { recursive: true })
    cpSync(websocketSrc, websocketDst, { recursive: true })

    // Step 3: Update upstream package.json
    console.log('📝 Step 3: Updating upstream package.json')
    updateUpstreamPackageJson(upstreamCloudflareDir)

    // Step 3.1: Resolve workspace deps for build
    console.log('📦 Step 3.1: Resolving workspace dependencies')
    resolveWorkspaceDeps(join(upstreamCloudflareDir, 'package.json'), upstreamPackagesDir)

    // Step 3.2: Install dependencies
    console.log('📦 Step 3.2: Installing dependencies in upstream workspace')
    execSync('pnpm install --no-frozen-lockfile', { cwd: astroUpstreamDir, stdio: 'inherit' })

    // Step 4: Build
    console.log('🏗️ Step 4: Building in upstream workspace')
    execSync('pnpm run build --filter @astrojs/cloudflare', { cwd: astroUpstreamDir, stdio: 'inherit' })

    // Step 5: Copy built dist to final package
    console.log('📦 Step 5: Copying built dist to final package')
    if (existsSync(finalCloudflareDir)) {
      rmSync(finalCloudflareDir, { recursive: true })
    }
    mkdirSync(finalCloudflareDir, { recursive: true })

    const upstreamDistDir = join(upstreamCloudflareDir, 'dist')
    if (existsSync(upstreamDistDir)) {
      cpSync(upstreamDistDir, join(finalCloudflareDir, 'dist'), { recursive: true })
    }

    // Create final package.json
    createFinalPackageJson(
      join(upstreamCloudflareDir, 'package.json'),
      join(finalCloudflareDir, 'package.json'),
      upstreamPackagesDir,
      {
        name: 'zastro-websockets-cloudflare',
        description: 'Deploy your site to Cloudflare Workers/Pages with WebSocket support',
      }
    )

    // Copy README
    const readmePath = join(rootDir, 'README.md')
    if (existsSync(readmePath)) {
      copyFileSync(readmePath, join(finalCloudflareDir, 'README.md'))
    }

    console.log('✅ Cloudflare WebSocket patch applied successfully')

    return () => {
      console.log('🔄 Restoring upstream Cloudflare adapter...')
      execSync('git checkout HEAD -- packages/integrations/cloudflare/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    }

  } catch (error: any) {
    console.log('🔄 Restoring upstream due to error...')
    try {
      execSync('git checkout HEAD -- packages/integrations/cloudflare/', { cwd: astroUpstreamDir, stdio: 'inherit' })
    } catch (restoreError: any) {
      console.warn('⚠️ Failed to restore upstream:', restoreError.message)
    }
    console.error('❌ Error applying Cloudflare WebSocket patch:', error.message)
    throw error
  }
}

// --- String replacements for upstream files ---

function applyImageConfigModifications(upstreamCloudflareDir: string): void {
  const filePath = join(upstreamCloudflareDir, 'src/utils/image-config.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  content = content.replace(/@astrojs\/cloudflare\/image-service/g, 'zastro-websockets-cloudflare/image-service')
  content = content.replace(/@astrojs\/cloudflare\/image-endpoint/g, 'zastro-websockets-cloudflare/image-endpoint')

  writeFileSync(filePath, content)
}

function applyIndexModifications(upstreamCloudflareDir: string): void {
  const filePath = join(upstreamCloudflareDir, 'src/index.ts')
  if (!existsSync(filePath)) return
  let content = readFileSync(filePath, 'utf-8')

  const packageName = 'zastro-websockets-cloudflare'

  // Add WebSocket middleware import
  if (!content.includes('websocket/middleware.js')) {
    content = content.replace(
      /import type { AstroAdapter/,
      `import { onRequest } from './websocket/middleware.js';
import type { AstroAdapter`
    )
  }

  // Add Locals interface
  if (!content.includes('interface Locals')) {
    const interfaceCode = `
declare global {
	namespace App {
		interface Locals {
			isUpgradeRequest?: boolean;
			upgradeWebSocket?: () => { socket: import('./websocket/websocket.js').WebSocket, response: Response };
			runtime?: {
				env: any;
				cf: any;
				ctx: any;
				caches: any;
				waitUntil: (promise: Promise<any>) => void;
			};
		}
	}
}
`
    content = content.replace(
      /export default function createIntegration/,
      interfaceCode + '\nexport default function createIntegration'
    )
  }

  // Add middleware setup
  if (!content.includes('addMiddleware')) {
    if (content.includes("'astro:config:setup'")) {
      content = content.replace(
        /'astro:config:setup': \(\{ updateConfig \}\) => \{/,
        `'astro:config:setup': ({ updateConfig, addMiddleware }) => {
					addMiddleware({
						entrypoint: '${packageName}/websocket/middleware.js',
						order: 'pre'
					});`
      )
    } else {
      content = content.replace(
        /hooks:\s*\{/,
        `hooks: {
			'astro:config:setup': ({ addMiddleware }) => {
				addMiddleware({
					entrypoint: '${packageName}/websocket/middleware.js',
					order: 'pre'
				});
			},`
      )
    }
  }

  // Replace package name references
  content = content.replace(/name: '@astrojs\/cloudflare'/g, `name: '${packageName}'`)
  content = content.replace(/'@astrojs\/cloudflare\/entrypoints\//g, `'${packageName}/entrypoints/`)
  content = content.replace(/"@astrojs\/cloudflare\/entrypoints\//g, `"${packageName}/entrypoints/`)
  content = content.replace(/serverEntrypoint: '@astrojs\/cloudflare\/entrypoints\/server\.js'/g, `serverEntrypoint: '${packageName}/entrypoints/server.js'`)

  writeFileSync(filePath, content)
}

// --- Package.json updates ---

function updateUpstreamPackageJson(upstreamCloudflareDir: string): void {
  const packageJsonPath = join(upstreamCloudflareDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

  // Add websocket exports
  if (!packageJson.exports) packageJson.exports = {}
  packageJson.exports['./websocket'] = './dist/websocket/index.js'
  packageJson.exports['./websocket/middleware.js'] = './dist/websocket/middleware.js'
  packageJson.exports['./websocket/websocket.js'] = './dist/websocket/websocket.js'
  packageJson.exports['./websocket/server.js'] = './dist/websocket/server.js'

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('✅ Updated upstream package.json with websocket exports')
}

export default applyCloudflareWebSocketPatch
