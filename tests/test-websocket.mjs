#!/usr/bin/env node

/**
 * Runtime WebSocket integration test
 * Starts the Node test server, connects a WebSocket, verifies messages, then exits.
 */

import { spawn } from 'node:child_process'
import { WebSocket } from 'ws'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverEntry = join(__dirname, 'projects/node/dist/server/entry.mjs')
const PORT = 4444
const HOST = '127.0.0.1'
const URL = `ws://${HOST}:${PORT}/api/websocket`

let server
let exitCode = 0

function log(msg) { console.log(`[test] ${msg}`) }
function fail(msg) { console.error(`[FAIL] ${msg}`); exitCode = 1 }
function pass(msg) { console.log(`[PASS] ${msg}`) }

async function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('node', [serverEntry], {
      env: { ...process.env, HOST, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let started = false
    const timeout = setTimeout(() => {
      if (!started) reject(new Error('Server failed to start within 10s'))
    }, 10000)

    server.stdout.on('data', (data) => {
      const line = data.toString()
      if (line.includes('Server listening') && !started) {
        started = true
        clearTimeout(timeout)
        resolve()
      }
    })

    server.stderr.on('data', (data) => {
      const line = data.toString().trim()
      if (line) console.error(`[server stderr] ${line}`)
    })

    server.on('error', reject)
  })
}

async function testWebSocket() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket test timed out after 5s'))
    }, 5000)

    const ws = new WebSocket(URL)
    const received = []

    ws.on('open', () => {
      log('Connected')
      ws.send('ping')
    })

    ws.on('message', (data) => {
      const msg = data.toString()
      received.push(msg)
      log(`Received: ${msg}`)

      // After welcome message + stats, we should get 'pong' back
      if (msg === 'pong') {
        pass('ping/pong works')
        ws.send('hello world')
      }

      if (msg === 'Echo: hello world') {
        pass('echo works')
        clearTimeout(timeout)
        ws.close()
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`WebSocket error: ${err.message}`))
    })

    ws.on('close', () => {
      log('Disconnected')

      // Validate we got the expected messages
      if (!received.includes('pong')) {
        fail('Never received pong response')
      }
      if (!received.includes('Echo: hello world')) {
        fail('Never received echo response')
      }
      if (received.some(m => m.includes('Welcome'))) {
        pass('Welcome message received')
      }

      resolve()
    })
  })
}

async function main() {
  try {
    log('Installing deps + building test project...')
    const { execSync } = await import('node:child_process')
    execSync('pnpm install && pnpm run build', {
      cwd: join(__dirname, 'projects/node'),
      stdio: 'inherit',
    })

    log('Starting server...')
    await startServer()
    log(`Server running on ${HOST}:${PORT}`)

    log('Testing WebSocket connection...')
    await testWebSocket()

  } catch (err) {
    fail(err.message)
  } finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(r => setTimeout(r, 500))
      if (!server.killed) server.kill('SIGKILL')
    }
  }

  if (exitCode === 0) {
    console.log('\n✅ All WebSocket tests passed')
  } else {
    console.log('\n❌ Some tests failed')
  }
  process.exit(exitCode)
}

main()
