/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Utility for managing BrowserOS process lifecycle in tests.
 * Reuses BrowserOS across multiple test runs within the same test session.
 */
import type {ChildProcess} from 'node:child_process';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {killProcessOnPort} from './utils.js';

interface BrowserOSConfig {
  cdpPort: number;
  tempUserDataDir: string;
  binaryPath: string;
}

let browserosProcess: ChildProcess | null = null;
let browserosConfig: BrowserOSConfig | null = null;

/**
 * Check if CDP is available on the specified port
 */
async function isCdpAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for CDP to be ready by polling the version endpoint
 */
async function waitForCdp(cdpPort: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // CDP not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`CDP failed to start on port ${cdpPort} within timeout`);
}

/**
 * Ensure BrowserOS is running with the specified configuration.
 * If already running with the same config, reuses the existing process.
 * If port conflicts with external process, kills it and retries.
 * Reads configuration from ENV variables (CDP_PORT, BROWSEROS_BINARY) by default.
 */
export async function ensureBrowserOS(options?: {
  cdpPort?: number;
  httpMcpPort?: number;
  agentPort?: number;
  extensionPort?: number;
  binaryPath?: string;
}): Promise<{
  cdpPort: number;
  tempUserDataDir: string;
}> {
  const cdpPort = options?.cdpPort ?? parseInt(process.env.CDP_PORT || '9005');
  const httpMcpPort =
    options?.httpMcpPort ?? parseInt(process.env.HTTP_MCP_PORT || '9105');
  const agentPort =
    options?.agentPort ?? parseInt(process.env.AGENT_PORT || '9205');
  const extensionPort =
    options?.extensionPort ?? parseInt(process.env.EXTENSION_PORT || '9305');
  const binaryPath =
    options?.binaryPath ??
    process.env.BROWSEROS_BINARY ??
    '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS';

  // Fast path: already running with same config
  if (
    browserosProcess &&
    browserosConfig &&
    browserosConfig.cdpPort === cdpPort &&
    browserosConfig.binaryPath === binaryPath
  ) {
    console.log(`Reusing existing BrowserOS on CDP port ${cdpPort}`);
    return {
      cdpPort: browserosConfig.cdpPort,
      tempUserDataDir: browserosConfig.tempUserDataDir,
    };
  }

  // Clean up any existing process if config changed
  if (browserosProcess) {
    console.log('Config changed, cleaning up existing BrowserOS...');
    await cleanupBrowserOS();
  }

  // kill the process on the port if an
  await killProcessOnPort(cdpPort);

  const portInUse = await isCdpAvailable(cdpPort);
  if (portInUse && !browserosProcess) {
    console.log(`CDP port ${cdpPort} is in use by external process...`);

    throw new Error(
      `CDP port ${cdpPort} is still in use after attempting to kill process. Please investigate manually.`,
    );
  }

  // Create temp user data directory
  const tempUserDataDir = mkdtempSync(join(tmpdir(), 'browseros-test-'));
  console.log(`\nCreated temp profile: ${tempUserDataDir}`);

  // Start BrowserOS
  console.log(`Starting BrowserOS on CDP port ${cdpPort}...`);
  browserosProcess = spawn(
    binaryPath,
    [
      '--use-mock-keychain',
      '--show-component-extension-options',
      '--enable-logging=stderr',
      '--headless=new',
      `--user-data-dir=${tempUserDataDir}`,
      `--remote-debugging-port=${cdpPort}`,
      `--browseros-mcp-port=${httpMcpPort}`,
      `--browseros-agent-port=${agentPort}`,
      `--browseros-extension-port=${extensionPort}`,
      '--disable-browseros-server',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  browserosProcess.stdout?.on('data', data => {
    // Uncomment for debugging
    // const output = data.toString().trim();
    // if (output) console.log(`[BROWSEROS] ${output}`);
  });

  browserosProcess.stderr?.on('data', data => {
    // Uncomment for debugging
    // const output = data.toString().trim();
    // if (output) console.log(`[BROWSEROS] ${output}`);
  });

  browserosProcess.on('error', error => {
    console.error('Failed to start BrowserOS:', error);
  });

  // Wait for CDP to be ready
  console.log('Waiting for CDP to be ready...');
  await waitForCdp(cdpPort);
  console.log('CDP is ready\n');

  // Store config
  browserosConfig = {
    cdpPort,
    tempUserDataDir,
    binaryPath,
  };

  return {
    cdpPort,
    tempUserDataDir,
  };
}

/**
 * Clean up BrowserOS process and temp directory.
 * Safe to call multiple times (idempotent).
 */
export async function cleanupBrowserOS(): Promise<void> {
  // Shutdown BrowserOS process
  if (browserosProcess) {
    console.log('\nShutting down BrowserOS...');
    browserosProcess.kill('SIGTERM');

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        browserosProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      browserosProcess?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    console.log('BrowserOS stopped');
    browserosProcess = null;
  }

  // Clean up temp directory
  if (browserosConfig?.tempUserDataDir) {
    console.log(`Cleaning up temp profile: ${browserosConfig.tempUserDataDir}`);
    try {
      rmSync(browserosConfig.tempUserDataDir, {recursive: true, force: true});
    } catch (error) {
      console.error('Failed to clean up temp directory:', error);
    }
  }

  // Clear config
  browserosConfig = null;
  console.log('Cleanup complete\n');
}
