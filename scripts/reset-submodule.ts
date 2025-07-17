#!/usr/bin/env node

/**
 * Force reset astro-upstream submodule to latest version
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const astroUpstreamDir = join(rootDir, 'astro-upstream')

console.log('🔄 Force resetting astro-upstream submodule...')

try {
  // First, clean up any existing submodule state
  if (existsSync(astroUpstreamDir)) {
    console.log('🧹 Cleaning existing submodule state...')
    
    // Nuclear option: remove all local changes first
    try {
      execSync('git stash --include-untracked', { cwd: astroUpstreamDir, stdio: 'pipe' })
      execSync('git stash drop', { cwd: astroUpstreamDir, stdio: 'pipe' })
    } catch {}
    
    try {
      execSync('git reset --hard HEAD', { cwd: astroUpstreamDir, stdio: 'pipe' })
    } catch {}
    
    try {
      execSync('git clean -fdx', { cwd: astroUpstreamDir, stdio: 'pipe' })
    } catch {}
  }

  // NOW initialize and update submodule
  console.log('📥 Initializing/updating submodule...')
  execSync('git submodule update --init --recursive --force', { cwd: rootDir, stdio: 'inherit' })

  // Navigate to submodule and ensure clean state
  if (existsSync(astroUpstreamDir)) {
    console.log('🔄 Setting up clean checkout...')
    
    // Fetch latest changes
    execSync('git fetch --all', { cwd: astroUpstreamDir, stdio: 'inherit' })
    
    // Get latest Astro release tag
    console.log('🏷️  Checking out latest astro tag...')
    const latestTag = execSync('git tag --list "astro@*" | sort -V | tail -1', { 
      cwd: astroUpstreamDir, 
      encoding: 'utf-8' 
    }).trim()
    
    if (latestTag) {
      console.log(`📌 Checking out tag: ${latestTag}`)
      execSync(`git checkout ${latestTag}`, { cwd: astroUpstreamDir, stdio: 'inherit' })
      console.log('✅ Successfully reset to latest Astro version')
    } else {
      console.warn('⚠️  No astro tags found, staying on current state')
    }
    
  } else {
    console.error('❌ astro-upstream directory not found')
    process.exit(1)
  }
  
} catch (error) {
  console.error('❌ Error resetting submodule:', error.message)
  process.exit(1)
}

console.log('🎉 Submodule reset complete!')