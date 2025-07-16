#!/usr/bin/env node

/**
 * Main dynamic build orchestrator
 * Uses the 5-step process for both adapters: copy upstream → modify local → build local
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCloudflareWebSocketPatch } from './dynamic-build-cloudflare.js'
import { applyNodeWebSocketPatch } from './dynamic-build-node.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const astroUpstreamDir = join(rootDir, 'astro-upstream')

console.log('🚀 Dynamic WebSocket build process...')

// Step 1: Clear any existing dist folders in packages
console.log('🧹 Clearing existing dist folders...')
const cloudflareDistTarget = join(rootDir, 'packages/cloudflare/dist')
const nodeDistTarget = join(rootDir, 'packages/node/dist')

if (existsSync(cloudflareDistTarget)) {
    rmSync(cloudflareDistTarget, { recursive: true })
    console.log('  ✅ Cleared packages/cloudflare/dist/')
}

if (existsSync(nodeDistTarget)) {
    rmSync(nodeDistTarget, { recursive: true })
    console.log('  ✅ Cleared packages/node/dist/')
}

// Step 2: Clean astro-upstream
console.log('🧹 Cleaning astro-upstream...')
try {
    execSync('git reset --hard HEAD', { cwd: astroUpstreamDir, stdio: 'inherit' })
    execSync('git clean -fd', { cwd: astroUpstreamDir, stdio: 'inherit' })
    console.log('✅ Clean state achieved')
} catch (error) {
    console.error('❌ Error cleaning:', error.message)
    process.exit(1)
}

// Step 3: Install dependencies in astro-upstream
console.log('📦 Installing astro-upstream dependencies...')
try {
    execSync('pnpm install --frozen-lockfile', { cwd: astroUpstreamDir, stdio: 'inherit' })
    console.log('✅ Dependencies installed')
} catch (error) {
    console.error('❌ Error installing dependencies:', error.message)
    process.exit(1)
}

// Step 4: Apply WebSocket patches using 5-step process
// Each adapter script handles: copy upstream → modify local → build local → create dist
try {
    console.log('🔧 Building Node.js adapter using 5-step process...')
    applyNodeWebSocketPatch(astroUpstreamDir, rootDir)
    console.log('✅ Node.js adapter built successfully')
    
    console.log('🔧 Building Cloudflare adapter using 5-step process...')
    applyCloudflareWebSocketPatch(astroUpstreamDir, rootDir)
    console.log('✅ Cloudflare adapter built successfully')
    
} catch (error) {
    console.error('❌ Error applying patches:', error.message)
    process.exit(1)
}

console.log('🎉 Complete! WebSocket-enabled adapters ready:')
console.log('  - Cloudflare: packages/cloudflare/dist/')
console.log('  - Node.js: packages/node/dist/')