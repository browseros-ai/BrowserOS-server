/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Low-level BrowserOS process management.
 * Use setup.ts:ensureBrowserOS() for the full test environment.
 */
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface BrowserConfig {
  cdpPort: number
  httpMcpPort: number
  extensionPort: number
  binaryPath: string
}

interface BrowserState {
  process: ChildProcess
  tempUserDataDir: string
  config: BrowserConfig
}

let browserState: BrowserState | null = null

export async function isBrowserRunning(cdpPort: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitForCdp(cdpPort: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isBrowserRunning(cdpPort)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`CDP failed to start on port ${cdpPort} within timeout`)
}

export function getBrowserState(): BrowserState | null {
  return browserState
}

export async function spawnBrowser(
  config: BrowserConfig,
): Promise<BrowserState> {
  if (browserState && browserState.config.cdpPort === config.cdpPort) {
    if (await isBrowserRunning(config.cdpPort)) {
      console.log(`Reusing existing browser on CDP port ${config.cdpPort}`)
      return browserState
    }
  }

  if (browserState) {
    console.log('Config changed, cleaning up existing browser...')
    await killBrowser()
  }

  const tempUserDataDir = mkdtempSync(join(tmpdir(), 'browseros-test-'))
  console.log(`Created temp profile: ${tempUserDataDir}`)

  console.log(`Starting BrowserOS on CDP port ${config.cdpPort}...`)
  const process = spawn(
    config.binaryPath,
    [
      '--use-mock-keychain',
      '--show-component-extension-options',
      '--enable-logging=stderr',
      '--headless=new',
      `--user-data-dir=${tempUserDataDir}`,
      `--remote-debugging-port=${config.cdpPort}`,
      `--browseros-mcp-port=${config.httpMcpPort}`,
      `--browseros-extension-port=${config.extensionPort}`,
      '--disable-browseros-server',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  process.stdout?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[BROWSER] ${_data.toString().trim()}`)
  })

  process.stderr?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[BROWSER] ${_data.toString().trim()}`)
  })

  process.on('error', (error) => {
    console.error('Failed to start BrowserOS:', error)
  })

  console.log('Waiting for CDP to be ready...')
  await waitForCdp(config.cdpPort)
  console.log('CDP is ready')

  browserState = { process, tempUserDataDir, config }
  return browserState
}

export async function killBrowser(): Promise<void> {
  if (!browserState) {
    return
  }

  console.log('Shutting down BrowserOS...')
  browserState.process.kill('SIGTERM')

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      browserState?.process.kill('SIGKILL')
      resolve()
    }, 5000)

    browserState?.process.on('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  console.log('BrowserOS stopped')

  if (browserState.tempUserDataDir) {
    console.log(`Cleaning up temp profile: ${browserState.tempUserDataDir}`)
    try {
      rmSync(browserState.tempUserDataDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp directory:', error)
    }
  }

  browserState = null
}
