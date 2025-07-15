#!/usr/bin/env node

/**
 * Build script for patched Astro adapters
 * 
 * This script:
 * 1. Applies patches to the astro-upstream submodule
 * 2. Builds the patched adapters 
 * 3. Copies the built adapters to our dist directory
 * 4. Exports them as part of our package
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const astroUpstreamDir = join(rootDir, 'astro-upstream')
const distDir = join(rootDir, 'dist')
const patchesDir = join(rootDir, 'patches')

console.log('🚀 Building patched Astro adapters...')

// Ensure we're in the right directory
process.chdir(rootDir)

// Step 1: Check if astro-upstream exists and is a git repo
if (!existsSync(astroUpstreamDir)) {
    console.error('❌ Error: astro-upstream directory not found')
    console.error('   Make sure the git submodule is initialized')
    process.exit(1)
}

// Step 2: Apply patches
console.log('📦 Applying WebSocket patches...')

try {
    // Reset astro-upstream to clean state
    execSync('git reset --hard HEAD', { cwd: astroUpstreamDir, stdio: 'inherit' })
    execSync('git clean -fd', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Apply node adapter patch
    const nodePatchFile = join(patchesDir, 'node/v5/websocket-support.patch')
    if (existsSync(nodePatchFile)) {
        console.log('  • Applying Node.js adapter patch...')
        execSync(`git apply "${nodePatchFile}"`, { cwd: astroUpstreamDir, stdio: 'inherit' })
    } else {
        console.warn('  ⚠️  Node.js patch not found, skipping...')
    }
    
    // Apply cloudflare adapter patch
    const cloudflarePatchFile = join(patchesDir, 'cloudflare/v5/cloudflare-websocket-support.patch')
    if (existsSync(cloudflarePatchFile)) {
        console.log('  • Applying Cloudflare adapter patch...')
        execSync(`git apply "${cloudflarePatchFile}"`, { cwd: astroUpstreamDir, stdio: 'inherit' })
    } else {
        console.warn('  ⚠️  Cloudflare patch not found, skipping...')
    }
    
    console.log('✅ Patches applied successfully!')
    
} catch (error) {
    console.error('❌ Error applying patches:', error.message)
    process.exit(1)
}

// Step 3: Skip dependency install - use pre-built adapters from the monorepo
console.log('📦 Using pre-built adapters from astro-upstream...')

// Step 4: Verify adapters are ready  
console.log('🔨 Verifying adapter builds...')

const nodeAdapterDir = join(astroUpstreamDir, 'packages/integrations/node')
const nodeDistDir = join(nodeAdapterDir, 'dist')
const cloudflareAdapterDir = join(astroUpstreamDir, 'packages/integrations/cloudflare')
const cloudflareDistDir = join(cloudflareAdapterDir, 'dist')

if (existsSync(nodeDistDir)) {
    console.log('  ✅ Node.js adapter pre-built and ready')
} else {
    console.error('  ❌ Node.js adapter not found - run git submodule update --init first')
    process.exit(1)
}

if (existsSync(cloudflareDistDir)) {
    console.log('  ✅ Cloudflare adapter pre-built and ready')
} else {
    console.error('  ❌ Cloudflare adapter not found - run git submodule update --init first')
    process.exit(1)
}

// Step 5: Copy patched source files to our src directory for building
console.log('📂 Copying patched source files...')

const srcAdaptersDir = join(rootDir, 'src/adapters/patched')

try {
    // Ensure target directory exists
    if (existsSync(srcAdaptersDir)) {
        rmSync(srcAdaptersDir, { recursive: true })
    }
    mkdirSync(srcAdaptersDir, { recursive: true })
    
    // Copy node adapter source
    const nodeSrcDir = join(astroUpstreamDir, 'packages/integrations/node/src')
    const nodeTargetDir = join(srcAdaptersDir, 'node')
    
    if (existsSync(nodeSrcDir)) {
        cpSync(nodeSrcDir, nodeTargetDir, { recursive: true })
        
        // Fix @astrojs/internal-helpers import path and update entrypoints
        const indexFile = join(nodeTargetDir, 'index.ts')
        if (existsSync(indexFile)) {
            const fs = await import('node:fs')
            let content = fs.readFileSync(indexFile, 'utf-8')
            content = content.replace(
                "from '@astrojs/internal-helpers/dist/fs.js'",
                "from '@astrojs/internal-helpers/fs'"
            )
            // Fix entrypoints to point to our patched versions
            content = content.replace(
                'serverEntrypoint: \'@astrojs/node/server.js\'',
                'serverEntrypoint: \'zastro-websockets/node/server.js\''
            )
            content = content.replace(
                'previewEntrypoint: \'@astrojs/node/preview.js\'',
                'previewEntrypoint: \'zastro-websockets/node/preview.js\''
            )
            fs.writeFileSync(indexFile, content)
        }
        
        // Fix UpgradeResponse status issue
        const responseFile = join(nodeTargetDir, 'websocket/response.ts')
        if (existsSync(responseFile)) {
            const fs = await import('node:fs')
            let content = fs.readFileSync(responseFile, 'utf-8')
            content = content.replace(
                'super(null, {\n            status: 101,',
                'super(null, {\n            status: 200,'
            )
            content = content.replace(
                '    constructor() {\n        super(null, {',
                `    constructor() {
        // Use status 200 for Response constructor, but we'll handle 101 manually
        super(null, {`
            )
            // Add status override after constructor
            if (!content.includes('Object.defineProperty(this, \'status\'')) {
                content = content.replace(
                    '        })\n    }',
                    `        })
        
        // Override the status property to 101 for WebSocket upgrade
        Object.defineProperty(this, 'status', {
            value: 101,
            writable: false,
            enumerable: true,
            configurable: false
        })
    }`
                )
            }
            fs.writeFileSync(responseFile, content)
        }
        
        console.log('  ✅ Node.js adapter source copied and fixed')
        
        // Also copy package.json
        const nodePackageJson = join(astroUpstreamDir, 'packages/integrations/node/package.json')
        if (existsSync(nodePackageJson)) {
            cpSync(nodePackageJson, join(nodeTargetDir, 'package.json'))
        }
    }
    
    // Copy cloudflare adapter source (now with WebSocket support)
    const cloudflareSrcDir = join(astroUpstreamDir, 'packages/integrations/cloudflare/src')
    const cloudflareTargetDir = join(srcAdaptersDir, 'cloudflare')
    
    if (existsSync(cloudflareSrcDir)) {
        cpSync(cloudflareSrcDir, cloudflareTargetDir, { recursive: true })
        
        // Fix Cloudflare adapter entrypoints to point to our patched versions
        const cloudflareIndexFile = join(cloudflareTargetDir, 'index.ts')
        if (existsSync(cloudflareIndexFile)) {
            const fs = await import('node:fs')
            let content = fs.readFileSync(cloudflareIndexFile, 'utf-8')
            
            // Fix entrypoints to point to our patched versions  
            content = content.replace(
                'serverEntrypoint: customWorkerEntryPoint ?? \'@astrojs/cloudflare/entrypoints/server.js\'',
                'serverEntrypoint: customWorkerEntryPoint ?? \'zastro-websockets/cloudflare/server.js\''
            )
            
            // Fix middleware entrypoint
            content = content.replace(
                'entrypoint: \'@astrojs/cloudflare/entrypoints/middleware.js\'',
                'entrypoint: \'zastro-websockets/cloudflare/middleware.js\''
            )
            
            fs.writeFileSync(cloudflareIndexFile, content)
        }
        
        // Fix image-config.ts entrypoints
        const imageConfigFile = join(cloudflareTargetDir, 'utils/image-config.ts')
        if (existsSync(imageConfigFile)) {
            const fs = await import('node:fs')
            let content = fs.readFileSync(imageConfigFile, 'utf-8')
            
            // Fix image service entrypoint
            content = content.replace(
                'entrypoint: \'@astrojs/cloudflare/image-service\'',
                'entrypoint: \'zastro-websockets/cloudflare/image-service\''
            )
            
            // Fix image endpoint entrypoint
            content = content.replace(
                'entrypoint: command === \'dev\' ? undefined : \'@astrojs/cloudflare/image-endpoint\'',
                'entrypoint: command === \'dev\' ? undefined : \'zastro-websockets/cloudflare/image-endpoint\''
            )
            
            fs.writeFileSync(imageConfigFile, content)
        }
        
        console.log('  ✅ Cloudflare adapter source copied and fixed')
        
        // Also copy package.json
        const cloudflarePackageJson = join(astroUpstreamDir, 'packages/integrations/cloudflare/package.json')
        if (existsSync(cloudflarePackageJson)) {
            cpSync(cloudflarePackageJson, join(cloudflareTargetDir, 'package.json'))
        }
    }
    
} catch (error) {
    console.error('❌ Error copying source files:', error.message)
    process.exit(1)
}

console.log('🎉 Patched adapters built successfully!')
console.log('')
console.log('📋 Available adapters:')
console.log('   • Node.js: import node from "zastro-websockets/node"')
console.log('   • Cloudflare: import cloudflare from "zastro-websockets/cloudflare"')
console.log('')
console.log('🚀 Ready to publish!')