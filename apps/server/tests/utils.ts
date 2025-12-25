/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Test utilities for BrowserOS server tests
 */
import { type ChildProcess, exec, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

// Track spawned browser process for cleanup
let browserProcess: ChildProcess | null = null

// Default BrowserOS path on macOS
const BROWSEROS_PATH =
  process.env.BROWSEROS_PATH ||
  '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS'

/**
 * Kill any process running on the specified port
 */
export async function killProcessOnPort(port: number): Promise<void> {
  try {
    // macOS/Linux: find and kill process on port
    await execAsync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`)
  } catch {
    // Ignore errors - process may not exist
  }
}

/**
 * Check if browser is running on CDP port
 */
async function isBrowserRunning(cdpPort: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Wait for browser to be ready on CDP port
 */
async function waitForBrowser(
  cdpPort: number,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isBrowserRunning(cdpPort)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Browser failed to start on CDP port ${cdpPort}`)
}

interface BrowserOSOptions {
  cdpPort: number
  httpPort?: number
  extensionPort?: number
}

/**
 * Ensure BrowserOS is running with CDP enabled.
 * If not running, launches it with remote debugging.
 */
export async function ensureBrowserOS(
  options: BrowserOSOptions,
): Promise<void> {
  const { cdpPort, httpPort, extensionPort } = options

  // Check if already running
  if (await isBrowserRunning(cdpPort)) {
    console.log(`BrowserOS already running on CDP port ${cdpPort}`)
    return
  }

  // Check if BrowserOS exists
  if (!existsSync(BROWSEROS_PATH)) {
    throw new Error(
      `BrowserOS not found at ${BROWSEROS_PATH}. Set BROWSEROS_PATH environment variable.`,
    )
  }

  console.log(`Launching BrowserOS: ${BROWSEROS_PATH}`)
  console.log(`CDP port: ${cdpPort}`)

  const userDataDir = `/tmp/browseros-test-${cdpPort}`

  // Launch BrowserOS with remote debugging
  browserProcess = spawn(
    BROWSEROS_PATH,
    [
      '--use-mock-keychain',
      '--show-component-extension-options',
      '--enable-logging=stderr',
      '--disable-browseros-server', // We run our own server
      `--remote-debugging-port=${cdpPort}`,
      ...(httpPort ? [`--browseros-mcp-port=${httpPort}`] : []),
      ...(extensionPort ? [`--browseros-extension-port=${extensionPort}`] : []),
      `--user-data-dir=${userDataDir}`,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    },
  )

  browserProcess.stdout?.on('data', (data) => {
    console.log(`[BROWSER] ${data.toString().trim()}`)
  })

  browserProcess.stderr?.on('data', (data) => {
    // BrowserOS logs a lot to stderr, only show errors
    const msg = data.toString().trim()
    if (msg.includes('ERROR') || msg.includes('error')) {
      console.error(`[BROWSER ERROR] ${msg}`)
    }
  })

  browserProcess.on('error', (err) => {
    console.error('Failed to launch BrowserOS:', err)
  })

  // Wait for browser to be ready
  await waitForBrowser(cdpPort)
  console.log(`BrowserOS ready on CDP port ${cdpPort}`)
}

/**
 * Cleanup browser process (call in afterAll)
 */
export async function cleanupBrowser(): Promise<void> {
  if (browserProcess) {
    console.log('Shutting down BrowserOS...')
    browserProcess.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        browserProcess?.kill('SIGKILL')
        resolve()
      }, 5000)

      browserProcess?.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    browserProcess = null
    console.log('BrowserOS stopped')
  }
}
