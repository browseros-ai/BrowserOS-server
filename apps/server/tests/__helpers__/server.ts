/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Low-level MCP server process management.
 * Use setup.ts:ensureBrowserOS() for the full test environment.
 */
import { type ChildProcess, spawn } from 'node:child_process'

export interface ServerConfig {
  cdpPort: number
  httpMcpPort: number
  extensionPort: number
}

interface ServerState {
  process: ChildProcess
  config: ServerConfig
}

let serverState: ServerState | null = null

export async function isServerRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitForHealth(port: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerRunning(port)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Server failed to start on port ${port} within timeout`)
}

export function getServerState(): ServerState | null {
  return serverState
}

export async function spawnServer(config: ServerConfig): Promise<ServerState> {
  if (
    serverState &&
    JSON.stringify(serverState.config) === JSON.stringify(config)
  ) {
    if (await isServerRunning(config.httpMcpPort)) {
      console.log(`Reusing existing server on port ${config.httpMcpPort}`)
      return serverState
    }
  }

  if (serverState) {
    console.log('Config changed, cleaning up existing server...')
    await killServer()
  }

  console.log(`Starting BrowserOS Server on port ${config.httpMcpPort}...`)
  const process = spawn(
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
      cwd: globalThis.process.cwd(),
      env: { ...globalThis.process.env, NODE_ENV: 'test' },
    },
  )

  process.stdout?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[SERVER] ${_data.toString().trim()}`)
  })

  process.stderr?.on('data', (_data) => {
    // Uncomment for debugging
    // console.error(`[SERVER] ${_data.toString().trim()}`)
  })

  process.on('error', (error) => {
    console.error('Failed to start server:', error)
  })

  console.log('Waiting for server to be ready...')
  await waitForHealth(config.httpMcpPort)
  console.log('Server is ready')

  serverState = { process, config }
  return serverState
}

export async function killServer(): Promise<void> {
  if (!serverState) {
    return
  }

  console.log('Shutting down server...')
  serverState.process.kill('SIGTERM')

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      serverState?.process.kill('SIGKILL')
      resolve()
    }, 5000)

    serverState?.process.on('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  console.log('Server stopped')
  serverState = null
}
