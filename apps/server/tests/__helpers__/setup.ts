/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Unified test environment orchestrator.
 * Ensures server + browser + extension are all ready.
 */
import { TEST_PORTS } from '@browseros/shared/ports'

import {
  type BrowserConfig,
  getBrowserState,
  killBrowser,
  spawnBrowser,
} from './browser.js'
import { getServerState, killServer, spawnServer } from './server.js'
import { killProcessOnPort } from './utils.js'

export interface TestEnvironmentConfig {
  cdpPort: number
  httpMcpPort: number
  extensionPort: number
}

const DEFAULT_CONFIG: TestEnvironmentConfig = {
  cdpPort: Number.parseInt(process.env.CDP_PORT || String(TEST_PORTS.cdp), 10),
  httpMcpPort: Number.parseInt(
    process.env.HTTP_MCP_PORT || String(TEST_PORTS.httpMcp),
    10,
  ),
  extensionPort: Number.parseInt(
    process.env.EXTENSION_PORT || String(TEST_PORTS.extension),
    10,
  ),
}

const DEFAULT_BINARY_PATH =
  process.env.BROWSEROS_BINARY ??
  '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS'

async function isExtensionConnected(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/extension-status`, {
      signal: AbortSignal.timeout(1000),
    })
    if (response.ok) {
      const data = (await response.json()) as { extensionConnected: boolean }
      return data.extensionConnected
    }
  } catch {
    // Not connected yet
  }
  return false
}

async function waitForExtensionConnection(
  port: number,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isExtensionConnected(port)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Extension failed to connect on port ${port} within timeout`)
}

function configsMatch(
  a: TestEnvironmentConfig,
  b: TestEnvironmentConfig,
): boolean {
  return (
    a.cdpPort === b.cdpPort &&
    a.httpMcpPort === b.httpMcpPort &&
    a.extensionPort === b.extensionPort
  )
}

/**
 * Ensures the full BrowserOS test environment is ready:
 * 1. Server running and healthy
 * 2. Browser running with CDP available
 * 3. Extension connected to server
 *
 * Reuses existing processes if already running with same config.
 */
export async function ensureBrowserOS(
  options?: Partial<TestEnvironmentConfig>,
): Promise<TestEnvironmentConfig> {
  const config: TestEnvironmentConfig = {
    cdpPort: options?.cdpPort ?? DEFAULT_CONFIG.cdpPort,
    httpMcpPort: options?.httpMcpPort ?? DEFAULT_CONFIG.httpMcpPort,
    extensionPort: options?.extensionPort ?? DEFAULT_CONFIG.extensionPort,
  }

  // Fast path: already running with same config and extension connected
  const serverState = getServerState()
  const browserState = getBrowserState()
  if (
    serverState &&
    browserState &&
    configsMatch(serverState.config, config) &&
    configsMatch(browserState.config, config)
  ) {
    if (await isExtensionConnected(config.httpMcpPort)) {
      console.log('Reusing existing test environment')
      return config
    }
  }

  // Config changed or not running: full setup
  console.log('\n=== Setting up BrowserOS test environment ===')

  // 1. Kill conflicting processes on ports
  await killProcessOnPort(config.httpMcpPort)
  await killProcessOnPort(config.extensionPort)
  await killProcessOnPort(config.cdpPort)

  // 2. Start server first (WebSocket ready for extension)
  await spawnServer(config)

  // 3. Start browser (extension will connect to server)
  const browserConfig: BrowserConfig = {
    ...config,
    binaryPath: DEFAULT_BINARY_PATH,
  }
  await spawnBrowser(browserConfig)

  // 4. Wait for extension to connect
  console.log('Waiting for extension to connect...')
  await waitForExtensionConnection(config.httpMcpPort)
  console.log('Extension connected')

  console.log('=== Test environment ready ===\n')
  return config
}

/**
 * Cleans up the full BrowserOS test environment.
 */
export async function cleanupBrowserOS(): Promise<void> {
  console.log('\n=== Cleaning up BrowserOS test environment ===')
  await killBrowser()
  await killServer()
  console.log('=== Cleanup complete ===\n')
}
