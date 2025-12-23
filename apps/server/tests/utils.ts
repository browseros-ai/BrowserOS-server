/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Test utilities for BrowserOS server tests
 */
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

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
 * Ensure BrowserOS is running with CDP enabled
 * This is a stub - in real tests, you'd start the actual BrowserOS binary
 */
export async function ensureBrowserOS(options: {
  cdpPort: number
}): Promise<void> {
  // Check if BrowserOS is already running on the CDP port
  try {
    const response = await fetch(
      `http://127.0.0.1:${options.cdpPort}/json/version`,
      {
        signal: AbortSignal.timeout(2000),
      },
    )
    if (response.ok) {
      console.log(`BrowserOS already running on CDP port ${options.cdpPort}`)
      return
    }
  } catch {
    // Not running, would need to start it
    console.log(`BrowserOS not running on CDP port ${options.cdpPort}`)
    console.log('Integration tests require BrowserOS to be running')
    // In real implementation, you would start BrowserOS here
  }
}
