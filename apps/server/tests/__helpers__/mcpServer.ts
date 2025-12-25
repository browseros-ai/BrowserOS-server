/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Utility for managing BrowserOS MCP Server lifecycle in tests.
 * Reuses server across multiple test runs within the same test session.
 */
import { type ChildProcess, spawn } from 'node:child_process'

import { ensureBrowserOS } from './browseros.js'
import { killProcessOnPort } from './utils.js'

export interface ServerConfig {
  cdpPort: number
  httpMcpPort: number
  extensionPort: number
}

let serverProcess: ChildProcess | null = null
let serverConfig: ServerConfig | null = null

async function isServerAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) {
        return
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Server failed to start on port ${port} within timeout`)
}

export async function ensureServer(
  options?: Partial<ServerConfig>,
): Promise<ServerConfig> {
  const config: ServerConfig = {
    cdpPort: options?.cdpPort ?? parseInt(process.env.CDP_PORT || '9005', 10),
    httpMcpPort:
      options?.httpMcpPort ?? parseInt(process.env.HTTP_MCP_PORT || '9105', 10),
    extensionPort:
      options?.extensionPort ??
      parseInt(process.env.EXTENSION_PORT || '9305', 10),
  }

  // Fast path: already running with same config
  if (
    serverProcess &&
    serverConfig &&
    JSON.stringify(serverConfig) === JSON.stringify(config)
  ) {
    console.log(`Reusing existing server on port ${config.httpMcpPort}`)
    return serverConfig
  }

  // Config changed: cleanup old server
  if (serverProcess) {
    console.log('Config changed, cleaning up existing server...')
    await cleanupServer()
  }

  // Ensure BrowserOS is running first
  await ensureBrowserOS({
    cdpPort: config.cdpPort,
    httpMcpPort: config.httpMcpPort,
    extensionPort: config.extensionPort,
  })

  // Check if server already running (from previous test run)
  if (await isServerAvailable(config.httpMcpPort)) {
    console.log(
      `Server already running on port ${config.httpMcpPort}, reusing it`,
    )
    serverConfig = config
    return config
  }

  // Kill conflicting processes
  await killProcessOnPort(config.httpMcpPort)
  await killProcessOnPort(config.extensionPort)

  // Start server - updated path for new structure
  console.log(`Starting BrowserOS Server on port ${config.httpMcpPort}...`)
  serverProcess = spawn(
    'bun',
    [
      'apps/server/src/index.ts',
      '--cdp-port',
      config.cdpPort.toString(),
      '--http-mcp-port',
      config.httpMcpPort.toString(),
      '--extension-port',
      config.extensionPort.toString(),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
    },
  )

  serverProcess.stdout?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[SERVER] ${data.toString().trim()}`);
  })

  serverProcess.stderr?.on('data', (_data) => {
    // Uncomment for debugging
    // console.error(`[SERVER] ${data.toString().trim()}`);
  })

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error)
  })

  console.log('Waiting for server to be ready...')
  await waitForServer(config.httpMcpPort)
  console.log('Server is ready')

  // Give extension time to connect to WebSocket
  console.log('Waiting for extension to connect...')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  console.log('Ready\n')

  serverConfig = config
  return config
}

export async function cleanupServer(): Promise<void> {
  if (serverProcess) {
    console.log('\nShutting down server...')
    serverProcess.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        serverProcess?.kill('SIGKILL')
        resolve()
      }, 5000)

      serverProcess?.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    console.log('Server stopped')
    serverProcess = null
  }

  serverConfig = null
  console.log('Server cleanup complete\n')
}
