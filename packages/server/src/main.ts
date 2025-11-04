/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
import type http from 'node:http';

import {
  createAgentServer,
  registerAgents,
  type AgentServerConfig,
} from '@browseros/agent';
import {
  ensureBrowserConnected,
  McpContext,
  Mutex,
  logger,
  readVersion,
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
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

import {parseArguments} from './args.js';

const version = readVersion();
const ports = parseArguments();

const logDir = ports.executionDir || ports.resourcesDir;
if (logDir) {
  logger.setLogFile(logDir);
}

void (async () => {
  logger.info(`Starting BrowserOS Server v${version}`);

  logger.info(
    `[Controller Server] Starting on ws://127.0.0.1:${ports.extensionPort}`,
  );
  const {controllerBridge, controllerContext} = createController(
    ports.extensionPort,
  );

  const cdpContext = await connectToCdp(ports.cdpPort);

  logger.info(
    `Loaded ${allControllerTools.length} controller (extension) tools`,
  );
  const tools = mergeTools(cdpContext, controllerContext);
  const toolMutex = new Mutex();

  const mcpServer = startMcpServer({
    ports,
    version,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
  });

  const agentServer = await startAgentServer(ports, controllerBridge);

  logSummary(ports);

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

function startMcpServer(config: {
  ports: ReturnType<typeof parseArguments>;
  version: string;
  tools: Array<ToolDefinition<any, any, any>>;
  cdpContext: McpContext | null;
  controllerContext: ControllerContext;
  toolMutex: Mutex;
}): http.Server {
  const {ports, version, tools, cdpContext, controllerContext, toolMutex} =
    config;

  const mcpServer = createHttpMcpServer({
    port: ports.httpMcpPort,
    version,
    tools,
    context: cdpContext || ({} as any),
    controllerContext,
    toolMutex,
    logger,
    mcpServerEnabled: ports.mcpServerEnabled,
  });

  if (!ports.mcpServerEnabled) {
    logger.info('[MCP Server] Disabled (--disable-mcp-server)');
  } else {
    logger.info(
      `[MCP Server] Listening on http://127.0.0.1:${ports.httpMcpPort}/mcp`,
    );
    logger.info(
      `[MCP Server] Health check: http://127.0.0.1:${ports.httpMcpPort}/health`,
    );
  }

  return mcpServer;
}

/**
 * Get LLM configuration - either all env vars OR all config values (no mixing)
 * Environment variables take precedence: if any env var is set, use all env vars
 * Otherwise, fetch and use 'default' provider from BROWSEROS_CONFIG_URL
 */
async function getLLMConfig(): Promise<{
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}> {
  // Check if any environment variable is set
  const envApiKey = process.env.BROWSEROS_API_KEY;
  const envBaseUrl = process.env.BROWSEROS_LLM_BASE_URL;
  const envModelName = process.env.BROWSEROS_LLM_MODEL_NAME;
  const hasAnyEnvVar =
    envApiKey !== undefined ||
    envBaseUrl !== undefined ||
    envModelName !== undefined;

  // If any env var is set, use all env vars (no mixing with config)
  if (hasAnyEnvVar) {
    logger.info('✅ Using LLM config from environment variables');
    return {
      apiKey: envApiKey,
      baseUrl: envBaseUrl,
      modelName: envModelName,
    };
  }

  // No env vars set, try to fetch from config URL
  const configUrl = process.env.BROWSEROS_CONFIG_URL;
  if (configUrl) {
    try {
      logger.info('🌐 Fetching LLM config from BrowserOS Config URL', {
        configUrl,
      });
      const config = await fetchBrowserOSConfig(configUrl);
      const llmConfig = getLLMConfigFromProvider(config, 'default');

      logger.info('✅ Using LLM config from BrowserOS Config (default provider)');
      return {
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        modelName: llmConfig.modelName,
      };
    } catch (error) {
      logger.warn(
        '⚠️  Failed to fetch config from URL, no LLM config available',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  // No env vars and no config available
  return {
    apiKey: undefined,
    baseUrl: undefined,
    modelName: undefined,
  };
}

async function startAgentServer(
  ports: ReturnType<typeof parseArguments>,
  controllerBridge: ControllerBridge,
): Promise<any> {
  // Register all available agents (Codex SDK, Claude SDK, etc.)
  registerAgents();

  const llmConfig = await getLLMConfig();

  const resourcesDir = ports.resourcesDir || process.cwd();
  const executionDir = ports.executionDir || resourcesDir;

  const agentConfig: AgentServerConfig = {
    port: ports.agentPort,
    resourcesDir,
    executionDir,
    mcpServerPort: ports.httpMcpPort,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    modelName: llmConfig.modelName,
    maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
    idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '90000'),
    eventGapTimeoutMs: parseInt(process.env.EVENT_GAP_TIMEOUT_MS || '120000'),
  };

  const agentServer = createAgentServer(agentConfig, controllerBridge);

  logger.info(`[Agent Server] Listening on ws://127.0.0.1:${ports.agentPort}`);
  logger.info(
    `[Agent Server] Config: resourcesDir=${agentConfig.resourcesDir}, model=${agentConfig.modelName || 'default'}, sessions=${agentConfig.maxSessions}`,
  );

  return agentServer;
}

function logSummary(ports: ReturnType<typeof parseArguments>) {
  logger.info('');
  logger.info('Services running:');
  logger.info(`  Controller Server: ws://127.0.0.1:${ports.extensionPort}`);
  logger.info(`  Agent Server: ws://127.0.0.1:${ports.agentPort}`);
  if (ports.mcpServerEnabled) {
    logger.info(`  MCP Server: http://127.0.0.1:${ports.httpMcpPort}/mcp`);
  }
  logger.info('');
}

function createShutdownHandler(
  mcpServer: http.Server,
  agentServer: any,
  controllerBridge: ControllerBridge,
) {
  return async () => {
    logger.info('Shutting down server...');

    await shutdownMcpServer(mcpServer, logger);

    logger.info('Stopping agent server...');
    agentServer.stop();

    logger.info('Closing ControllerBridge...');
    await controllerBridge.close();

    logger.info('Server shutdown complete');
    process.exit(0);
  };
}
