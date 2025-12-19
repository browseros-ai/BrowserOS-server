/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
// Sentry import should happen before any other logic
import {Sentry} from '@browseros/common/sentry';

import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

import {
  createHttpServer as createAgentHttpServer,
  RateLimiter,
} from '@browseros/agent';
import {
  ensureBrowserConnected,
  McpContext,
  Mutex,
  logger,
  metrics,
  readVersion,
  initializeDb,
  identity,
  fetchBrowserOSConfig,
} from '@browseros/common';
import {
  ControllerContext,
  ControllerBridge,
} from '@browseros/controller-server';
import {createHttpMcpServer, shutdownMcpServer} from '@browseros/mcp';
import {
  allCdpTools,
  allControllerTools,
  type ToolDefinition,
} from '@browseros/tools';

import {loadServerConfig, type ServerConfig} from './config.js';

const version = readVersion();
const configResult = loadServerConfig();

if (!configResult.ok) {
  Sentry.captureException(new Error(configResult.error));
  console.error(configResult.error);
  process.exit(1);
}

const config: ServerConfig = configResult.value;

configureLogDirectory(config.executionDir);

// Initialize database and identity service
const dbPath = path.join(
  config.executionDir || config.resourcesDir,
  'browseros.db',
);
const db = initializeDb(dbPath);

identity.initialize({
  installId: config.instanceInstallId,
  db,
});

const browserosId = identity.getBrowserOSId();
logger.info('[Identity] BrowserOS ID initialized', {
  browserosId: browserosId.slice(0, 12),
  fromConfig: !!config.instanceInstallId,
});

// Initialize metrics and Sentry (uses install_id from config for analytics)
metrics.initialize({
  client_id: config.instanceClientId,
  install_id: config.instanceInstallId,
  browseros_version: config.instanceBrowserosVersion,
  chromium_version: config.instanceChromiumVersion,
});

Sentry.setContext('browseros', {
  client_id: config.instanceClientId,
  install_id: config.instanceInstallId,
  browseros_version: config.instanceBrowserosVersion,
  chromium_version: config.instanceChromiumVersion,
});

const DEFAULT_DAILY_RATE_LIMIT = 5;
const DEV_DAILY_RATE_LIMIT = 100;

void (async () => {
  logger.info(`Starting BrowserOS Server v${version}`);

  // Fetch rate limit config from Cloudflare worker
  const dailyRateLimit = await fetchDailyRateLimit();

  logger.info(
    `[Controller Server] Starting on ws://127.0.0.1:${config.extensionPort}`,
  );
  const {controllerBridge, controllerContext} = createController(
    config.extensionPort,
  );

  const cdpContext = await connectToCdp(config.cdpPort);

  logger.info(
    `Loaded ${allControllerTools.length} controller (extension) tools`,
  );
  const tools = mergeTools(cdpContext, controllerContext);
  const toolMutex = new Mutex();

  const mcpServer = startMcpServer({
    config,
    version,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
  });

  const agentServer = startAgentServer(config, dailyRateLimit);

  logSummary(config);

  const shutdown = createShutdownHandler(
    mcpServer,
    agentServer,
    controllerBridge,
  );
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();

function createController(extensionPort: number) {
  const controllerBridge = new ControllerBridge(extensionPort, logger);
  const controllerContext = new ControllerContext(controllerBridge);
  return {controllerBridge, controllerContext};
}

async function connectToCdp(
  cdpPort: number | null,
): Promise<McpContext | null> {
  if (!cdpPort) {
    logger.info(
      'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
    );
    return null;
  }

  try {
    const browser = await ensureBrowserConnected(`http://127.0.0.1:${cdpPort}`);
    logger.info(`Connected to CDP at http://127.0.0.1:${cdpPort}`);
    const context = await McpContext.from(browser, logger);
    logger.info(`Loaded ${allCdpTools.length} CDP tools`);
    return context;
  } catch (error) {
    logger.warn(
      `Warning: Could not connect to CDP at http://127.0.0.1:${cdpPort}`,
    );
    logger.warn(
      'CDP tools will not be available. Only extension tools will work.',
    );
    return null;
  }
}

function wrapControllerTools(
  tools: typeof allControllerTools,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  return tools.map((tool: any) => ({
    ...tool,
    handler: async (request: any, response: any, _context: any) => {
      return tool.handler(request, response, controllerContext);
    },
  }));
}

function mergeTools(
  cdpContext: McpContext | null,
  controllerContext: ControllerContext,
): Array<ToolDefinition<any, any, any>> {
  const cdpTools = cdpContext ? allCdpTools : [];
  const wrappedControllerTools = wrapControllerTools(
    allControllerTools,
    controllerContext,
  );

  logger.info(
    `Total tools available: ${cdpTools.length + wrappedControllerTools.length} ` +
      `(${cdpTools.length} CDP + ${wrappedControllerTools.length} extension)`,
  );

  return [...cdpTools, ...wrappedControllerTools];
}

function startMcpServer(params: {
  config: ServerConfig;
  version: string;
  tools: Array<ToolDefinition<any, any, any>>;
  cdpContext: McpContext | null;
  controllerContext: ControllerContext;
  toolMutex: Mutex;
}): http.Server {
  const {config, version, tools, cdpContext, controllerContext, toolMutex} =
    params;

  const mcpServer = createHttpMcpServer({
    port: config.httpMcpPort,
    version,
    tools,
    context: cdpContext || ({} as any),
    controllerContext,
    toolMutex,
    logger,
    allowRemote: config.mcpAllowRemote,
  });

  logger.info(
    `[MCP Server] Listening on http://127.0.0.1:${config.httpMcpPort}/mcp`,
  );
  logger.info(
    `[MCP Server] Health check: http://127.0.0.1:${config.httpMcpPort}/health`,
  );
  if (config.mcpAllowRemote) {
    logger.warn('[MCP Server] Remote connections enabled (--mcp-allow-remote)');
  }

  return mcpServer;
}

async function fetchDailyRateLimit(): Promise<number> {
  // Dev mode: skip fetch, use higher limit for local development
  if (process.env.NODE_ENV === 'development') {
    logger.info('[Config] Dev mode: using dev rate limit', {
      dailyRateLimit: DEV_DAILY_RATE_LIMIT,
    });
    return DEV_DAILY_RATE_LIMIT;
  }

  const configUrl = process.env.BROWSEROS_CONFIG_URL;
  if (!configUrl) {
    logger.info('[Config] No BROWSEROS_CONFIG_URL, using default rate limit', {
      dailyRateLimit: DEFAULT_DAILY_RATE_LIMIT,
    });
    return DEFAULT_DAILY_RATE_LIMIT;
  }

  try {
    const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId);
    const defaultProvider = browserosConfig.providers.find(
      p => p.name === 'default',
    );
    const dailyRateLimit =
      defaultProvider?.dailyRateLimit ?? DEFAULT_DAILY_RATE_LIMIT;

    logger.info('[Config] Rate limit config fetched', {dailyRateLimit});
    return dailyRateLimit;
  } catch (error) {
    logger.warn('[Config] Failed to fetch rate limit config, using default', {
      error: error instanceof Error ? error.message : String(error),
      dailyRateLimit: DEFAULT_DAILY_RATE_LIMIT,
    });
    return DEFAULT_DAILY_RATE_LIMIT;
  }
}

function startAgentServer(
  serverConfig: ServerConfig,
  dailyRateLimit: number,
): {
  server: any;
  config: any;
} {
  const mcpServerUrl = `http://127.0.0.1:${serverConfig.httpMcpPort}/mcp`;

  const rateLimiter = new RateLimiter(db, dailyRateLimit);
  logger.info('[Agent Server] Rate limiter initialized', {dailyRateLimit});

  const {server, config} = createAgentHttpServer({
    port: serverConfig.agentPort,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    tempDir: serverConfig.executionDir || serverConfig.resourcesDir,
    mcpServerUrl,
    rateLimiter,
    browserosId,
  });

  logger.info(
    `[Agent Server] Listening on http://127.0.0.1:${serverConfig.agentPort}`,
  );
  logger.info(`[Agent Server] MCP Server URL: ${mcpServerUrl}`);

  return {server, config};
}

function logSummary(serverConfig: ServerConfig) {
  logger.info('');
  logger.info('Services running:');
  logger.info(
    `  Controller Server: ws://127.0.0.1:${serverConfig.extensionPort}`,
  );
  logger.info(`  Agent Server: http://127.0.0.1:${serverConfig.agentPort}`);
  logger.info(`  MCP Server: http://127.0.0.1:${serverConfig.httpMcpPort}/mcp`);
  logger.info('');
}

function createShutdownHandler(
  mcpServer: http.Server,
  agentServer: {server: any; config: any},
  controllerBridge: ControllerBridge,
) {
  return () => {
    logger.info('Shutting down server...');

    const forceExitTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 5000);

    Promise.all([
      shutdownMcpServer(mcpServer, logger),
      Promise.resolve(agentServer.server.stop()),
      controllerBridge.close(),
      metrics.shutdown(),
    ])
      .then(() => {
        clearTimeout(forceExitTimeout);
        logger.info('Server shutdown complete');
        process.exit(0);
      })
      .catch(err => {
        clearTimeout(forceExitTimeout);
        logger.error('Shutdown error:', err);
        process.exit(1);
      });
  };
}

function configureLogDirectory(logDirCandidate: string): void {
  const resolvedDir = path.isAbsolute(logDirCandidate)
    ? logDirCandidate
    : path.resolve(process.cwd(), logDirCandidate);

  try {
    fs.mkdirSync(resolvedDir, {recursive: true});
    logger.setLogFile(resolvedDir);
  } catch (error) {
    console.warn(
      `Failed to configure log directory ${resolvedDir}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
