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

// Step 5: Copy patched source files to our package directories for building
console.log('📂 Copying patched source files...')

const nodePackageAdapterDir = join(rootDir, 'packages/node/src/adapter')
const cloudflarePackageAdapterDir = join(rootDir, 'packages/cloudflare/src/adapter')

try {
    // Clean and prepare node package adapter directory
    if (existsSync(nodePackageAdapterDir)) {
        rmSync(nodePackageAdapterDir, { recursive: true })
    }
    mkdirSync(nodePackageAdapterDir, { recursive: true })
    
    // Copy node adapter source
    const nodeSrcDir = join(astroUpstreamDir, 'packages/integrations/node/src')
    const nodeTargetDir = nodePackageAdapterDir
    
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
            // Fix entrypoints to point to our new package structure
            content = content.replace(
                "serverEntrypoint: '@astrojs/node/server.js'",
                "serverEntrypoint: 'zastro-websockets-node/server'"
            )
            content = content.replace(
                "previewEntrypoint: '@astrojs/node/preview.js'",
                "previewEntrypoint: 'zastro-websockets-node/preview'"
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
    
    // Clean and prepare cloudflare package adapter directory
    if (existsSync(cloudflarePackageAdapterDir)) {
        rmSync(cloudflarePackageAdapterDir, { recursive: true })
    }
    mkdirSync(cloudflarePackageAdapterDir, { recursive: true })
    
    // Copy cloudflare adapter source (now with WebSocket support)
    const cloudflareSrcDir = join(astroUpstreamDir, 'packages/integrations/cloudflare/src')
    const cloudflareTargetDir = cloudflarePackageAdapterDir
    
    if (existsSync(cloudflareSrcDir)) {
        cpSync(cloudflareSrcDir, cloudflareTargetDir, { recursive: true })
        
        // Fix Cloudflare adapter entrypoints to point to our patched versions
        const cloudflareIndexFile = join(cloudflareTargetDir, 'index.ts')
        if (existsSync(cloudflareIndexFile)) {
            const fs = await import('node:fs')
            let content = fs.readFileSync(cloudflareIndexFile, 'utf-8')
            
            // Fix entrypoints to point to our new package structure
            content = content.replace(
                "serverEntrypoint: customWorkerEntryPoint ?? '@astrojs/cloudflare/entrypoints/server.js'",
                "serverEntrypoint: customWorkerEntryPoint ?? 'zastro-websockets-cloudflare/server'"
            )
            
            // Fix middleware entrypoint
            content = content.replace(
                "entrypoint: '@astrojs/cloudflare/entrypoints/middleware.js'",
                "entrypoint: 'zastro-websockets-cloudflare/middleware'"
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
                "entrypoint: '@astrojs/cloudflare/image-service'",
                "entrypoint: 'zastro-websockets-cloudflare/image-service'"
            )
            
            // Fix image endpoint entrypoint
            content = content.replace(
                "entrypoint: command === 'dev' ? undefined : '@astrojs/cloudflare/image-endpoint'",
                "entrypoint: command === 'dev' ? undefined : 'zastro-websockets-cloudflare/image-endpoint'"
            )
            
            fs.writeFileSync(imageConfigFile, content)
        }
        
        // Copy entrypoints to the separate entrypoints directory
        const entrypointsDir = join(rootDir, 'packages/cloudflare/src/entrypoints')
        if (existsSync(entrypointsDir)) {
            rmSync(entrypointsDir, { recursive: true })
        }
        mkdirSync(entrypointsDir, { recursive: true })
        
        const cloudflareEntrypointsDir = join(astroUpstreamDir, 'packages/integrations/cloudflare/src/entrypoints')
        if (existsSync(cloudflareEntrypointsDir)) {
            cpSync(cloudflareEntrypointsDir, entrypointsDir, { recursive: true })
            
            // Fix import paths in entrypoints
            const fs = await import('node:fs')
            const serverFile = join(entrypointsDir, 'server.ts')
            const imageServiceFile = join(entrypointsDir, 'image-service.ts')
            
            if (existsSync(serverFile)) {
                let content = fs.readFileSync(serverFile, 'utf-8')
                content = content.replace(
                    "import { handle } from '../utils/handler.js';",
                    "import { handle } from '../adapter/utils/handler.js';"
                )
                fs.writeFileSync(serverFile, content)
            }
            
            if (existsSync(imageServiceFile)) {
                let content = fs.readFileSync(imageServiceFile, 'utf-8')
                content = content.replace(
                    "import { isRemoteAllowed } from '../utils/assets.js';",
                    "import { isRemoteAllowed } from '../adapter/utils/assets.js';"
                )
                fs.writeFileSync(imageServiceFile, content)
            }
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

// Step 6: Copy TypeScript declaration files from upstream
console.log('📝 Copying TypeScript declaration files...')

try {
    // Copy Node.js TypeScript declarations
    const nodeUpstreamDistDir = join(astroUpstreamDir, 'packages/integrations/node/dist')
    const nodePackageDistDir = join(rootDir, 'packages/node/dist')
    
    if (existsSync(nodeUpstreamDistDir)) {
        const nodeTypeFiles = [
            'index.d.ts',
            'preview.d.ts', 
            'server.d.ts',
            'websocket/websocket.d.ts',
            'websocket/serve-websocket.d.ts'
        ]
        
        for (const typeFile of nodeTypeFiles) {
            const srcFile = join(nodeUpstreamDistDir, typeFile)
            const destFile = join(nodePackageDistDir, 'adapter', typeFile)
            
            if (existsSync(srcFile)) {
                const destDir = dirname(destFile)
                if (!existsSync(destDir)) {
                    mkdirSync(destDir, { recursive: true })
                }
                cpSync(srcFile, destFile)
            }
        }
    }
    
    // Copy Cloudflare TypeScript declarations
    const cloudflareUpstreamDistDir = join(astroUpstreamDir, 'packages/integrations/cloudflare/dist')
    const cloudflarePackageDistDir = join(rootDir, 'packages/cloudflare/dist')
    
    if (existsSync(cloudflareUpstreamDistDir)) {
        const cloudflareTypeFiles = [
            'index.d.ts',
            'entrypoints/server.d.ts',
            'entrypoints/image-endpoint.d.ts',
            'entrypoints/image-service.d.ts',
            'entrypoints/middleware.d.ts'
        ]
        
        for (const typeFile of cloudflareTypeFiles) {
            const srcFile = join(cloudflareUpstreamDistDir, typeFile)
            const destFile = join(cloudflarePackageDistDir, typeFile)
            
            if (existsSync(srcFile)) {
                const destDir = dirname(destFile)
                if (!existsSync(destDir)) {
                    mkdirSync(destDir, { recursive: true })
                }
                cpSync(srcFile, destFile)
            }
        }
        
        // Also copy adapter index types
        const adapterIndexTypes = join(cloudflareUpstreamDistDir, 'index.d.ts')
        const adapterDestTypes = join(cloudflarePackageDistDir, 'adapter/index.d.ts')
        
        if (existsSync(adapterIndexTypes)) {
            const adapterDestDir = dirname(adapterDestTypes)
            if (!existsSync(adapterDestDir)) {
                mkdirSync(adapterDestDir, { recursive: true })
            }
            cpSync(adapterIndexTypes, adapterDestTypes)
        }
    }
    
    console.log('  ✅ TypeScript declaration files copied')
    
} catch (error) {
    console.error('❌ Error copying TypeScript declaration files:', error.message)
    process.exit(1)
}

console.log('🎉 Patched adapters built successfully!')
console.log('')
console.log('📋 Available adapters:')
console.log('   • Node.js: import node from "zastro-websockets-node"')
console.log('   • Cloudflare: import cloudflare from "zastro-websockets-cloudflare"')
console.log('')
console.log('🚀 Ready to publish!')