/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
// Sentry import should happen before any other logic

import fs from 'node:fs'
import path from 'node:path'
import { RATE_LIMITS } from '@browseros/shared/limits'
import { RateLimiter } from './agent/index.js'
import {
  ensureBrowserConnected,
  fetchBrowserOSConfig,
  identity,
  initializeDb,
  logger,
  McpContext,
  Mutex,
  metrics,
} from './common/index.js'
import { Sentry } from './common/sentry/instrument.js'
import { loadServerConfig, type ServerConfig } from './config.js'
import {
  ControllerBridge,
  ControllerContext,
} from './controller-server/index.js'
import { createHttpServer } from './http/index.js'
import {
  allCdpTools,
  allControllerTools,
  type ToolDefinition,
} from './tools/index.js'
import { VERSION } from './version.js'

const configResult = loadServerConfig()

if (!configResult.ok) {
  Sentry.captureException(new Error(configResult.error))
  console.error(configResult.error)
  process.exit(1)
}

const config: ServerConfig = configResult.value

configureLogDirectory(config.executionDir)

// Initialize database and identity service
const dbPath = path.join(
  config.executionDir || config.resourcesDir,
  'browseros.db',
)
const db = initializeDb(dbPath)

identity.initialize({
  installId: config.instanceInstallId,
  db,
})

const browserosId = identity.getBrowserOSId()
logger.info('BrowserOS ID initialized', {
  browserosId: browserosId.slice(0, 12),
  fromConfig: !!config.instanceInstallId,
})

// Initialize metrics and Sentry (uses install_id from config for analytics)
metrics.initialize({
  client_id: config.instanceClientId,
  install_id: config.instanceInstallId,
  browseros_version: config.instanceBrowserosVersion,
  chromium_version: config.instanceChromiumVersion,
})

Sentry.setContext('browseros', {
  client_id: config.instanceClientId,
  install_id: config.instanceInstallId,
  browseros_version: config.instanceBrowserosVersion,
  chromium_version: config.instanceChromiumVersion,
})

void (async () => {
  logger.info(`Starting BrowserOS Server v${VERSION}`)

  // Fetch rate limit config from Cloudflare worker
  const dailyRateLimit = await fetchDailyRateLimit()

  logger.info(
    `Controller server starting on ws://127.0.0.1:${config.extensionPort}`,
  )
  const { controllerBridge, controllerContext } = createController(
    config.extensionPort,
  )

  const cdpContext = await connectToCdp(config.cdpPort)

  logger.info(
    `Loaded ${allControllerTools.length} controller (extension) tools`,
  )
  const tools = mergeTools(cdpContext, controllerContext)
  const toolMutex = new Mutex()

  const httpServer = createHttpServer({
    port: config.httpMcpPort,
    host: '0.0.0.0',
    logger,
    // MCP config
    version: VERSION,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
    allowRemote: config.mcpAllowRemote,
    // Chat/Klavis config
    browserosId,
    tempDir: config.executionDir || config.resourcesDir,
    rateLimiter: new RateLimiter(db, dailyRateLimit),
  })

  logger.info(`HTTP server listening on http://127.0.0.1:${config.httpMcpPort}`)
  logger.info(`Health endpoint: http://127.0.0.1:${config.httpMcpPort}/health`)

  logSummary(config)

  const shutdown = createShutdownHandler(httpServer, controllerBridge)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})()

function createController(extensionPort: number) {
  const controllerBridge = new ControllerBridge(extensionPort, logger)
  const controllerContext = new ControllerContext(controllerBridge)
  return { controllerBridge, controllerContext }
}

async function connectToCdp(
  cdpPort: number | null,
): Promise<McpContext | null> {
  if (!cdpPort) {
    logger.info(
      'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
    )
    return null
  }

  try {
    const browser = await ensureBrowserConnected(`http://127.0.0.1:${cdpPort}`)
    logger.info(`Connected to CDP at http://127.0.0.1:${cdpPort}`)
    const context = await McpContext.from(browser, logger)
    logger.info(`Loaded ${allCdpTools.length} CDP tools`)
    return context
  } catch (_error) {
    logger.warn(
      `Warning: Could not connect to CDP at http://127.0.0.1:${cdpPort}`,
    )
    logger.warn(
      'CDP tools will not be available. Only extension tools will work.',
    )
    return null
  }
}

function wrapControllerTools(
  tools: typeof allControllerTools,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  return tools.map((tool: any) => ({
    ...tool,
    handler: async (request: any, response: any, _context: any) => {
      return tool.handler(request, response, controllerContext)
    },
  }))
}

function mergeTools(
  cdpContext: McpContext | null,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  const cdpTools = cdpContext ? allCdpTools : []
  const wrappedControllerTools = wrapControllerTools(
    allControllerTools,
    controllerContext,
  )

  logger.info(
    `Total tools available: ${cdpTools.length + wrappedControllerTools.length} ` +
      `(${cdpTools.length} CDP + ${wrappedControllerTools.length} extension)`,
  )

  return [...cdpTools, ...wrappedControllerTools]
}

async function fetchDailyRateLimit(): Promise<number> {
  // Test mode: skip rate limiting entirely
  if (process.env.NODE_ENV === 'test') {
    logger.info('Test mode: rate limiting disabled')
    return RATE_LIMITS.TEST_DAILY
  }

  // Dev mode: skip fetch, use higher limit for local development
  if (process.env.NODE_ENV === 'development') {
    logger.info('Dev mode: using dev rate limit', {
      dailyRateLimit: RATE_LIMITS.DEV_DAILY,
    })
    return RATE_LIMITS.DEV_DAILY
  }

  const configUrl = process.env.BROWSEROS_CONFIG_URL
  if (!configUrl) {
    logger.info('No BROWSEROS_CONFIG_URL, using default rate limit', {
      dailyRateLimit: RATE_LIMITS.DEFAULT_DAILY,
    })
    return RATE_LIMITS.DEFAULT_DAILY
  }

  try {
    const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId)
    const defaultProvider = browserosConfig.providers.find(
      (p) => p.name === 'default',
    )
    const dailyRateLimit =
      defaultProvider?.dailyRateLimit ?? RATE_LIMITS.DEFAULT_DAILY

    logger.info('Rate limit config fetched', { dailyRateLimit })
    return dailyRateLimit
  } catch (error) {
    logger.warn('Failed to fetch rate limit config, using default', {
      error: error instanceof Error ? error.message : String(error),
      dailyRateLimit: RATE_LIMITS.DEFAULT_DAILY,
    })
    return RATE_LIMITS.DEFAULT_DAILY
  }
}

function logSummary(serverConfig: ServerConfig) {
  logger.info('')
  logger.info('Services running:')
  logger.info(
    `  Controller Server: ws://127.0.0.1:${serverConfig.extensionPort}`,
  )
  logger.info(`  HTTP Server: http://127.0.0.1:${serverConfig.httpMcpPort}`)
  logger.info('')
}

function createShutdownHandler(
  httpServer: { server: ReturnType<typeof Bun.serve> },
  controllerBridge: ControllerBridge,
) {
  return () => {
    logger.info('Shutting down server...')

    const forceExitTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing exit')
      process.exit(1)
    }, 5000)

    Promise.all([
      Promise.resolve(httpServer.server.stop()),
      controllerBridge.close(),
      metrics.shutdown(),
    ])
      .then(() => {
        clearTimeout(forceExitTimeout)
        logger.info('Server shutdown complete')
        process.exit(0)
      })
      .catch((err) => {
        clearTimeout(forceExitTimeout)
        logger.error('Shutdown error:', err)
        process.exit(1)
      })
  }
}

function configureLogDirectory(logDirCandidate: string): void {
  const resolvedDir = path.isAbsolute(logDirCandidate)
    ? logDirCandidate
    : path.resolve(process.cwd(), logDirCandidate)

  try {
    fs.mkdirSync(resolvedDir, { recursive: true })
    logger.setLogFile(resolvedDir)
  } catch (error) {
    console.warn(
      `Failed to configure log directory ${resolvedDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
