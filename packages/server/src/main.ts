/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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
import {allKlavisTools} from '@browseros/tools/klavis';

import {parseArguments} from './args.js';

const version = readVersion();
const ports = parseArguments();

configureLogDirectory(ports.executionDir);

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
  const klavisTools = process.env.KLAVIS_API_KEY ? allKlavisTools : [];

  logger.info(
    `Total tools available: ${cdpTools.length + wrappedControllerTools.length + klavisTools.length} ` +
      `(${cdpTools.length} CDP + ${wrappedControllerTools.length} extension + ${klavisTools.length} Klavis)`,
  );

  return [...cdpTools, ...wrappedControllerTools, ...klavisTools];
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

// get LLM configuration for agent server
async function getLLMConfig(): Promise<{
  apiKey?: string;
  baseUrl: string;
  modelName: string;
}> {
  const envApiKey = process.env.BROWSEROS_API_KEY;
  const envBaseUrl = process.env.BROWSEROS_LLM_BASE_URL;
  const envModelName = process.env.BROWSEROS_LLM_MODEL_NAME;

  let configApiKey: string | undefined;
  let configBaseUrl: string | undefined;
  let configModelName: string | undefined;

  // Try to fetch from config URL
  const configUrl = process.env.BROWSEROS_CONFIG_URL;
  if (configUrl) {
    try {
      logger.info('Fetching LLM config from BrowserOS Config URL', {
        configUrl,
      });
      const config = await fetchBrowserOSConfig(configUrl);
      const llmConfig = getLLMConfigFromProvider(config, 'default');

      configApiKey = llmConfig.apiKey;
      configBaseUrl = llmConfig.baseUrl;
      configModelName = llmConfig.modelName;

      logger.info('Loaded config from BrowserOS Config (default provider)');
    } catch (error) {
      logger.warn('Failed to fetch config from URL', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Apply env var overrides (env takes precedence)
  const apiKey = envApiKey ?? configApiKey;
  const baseUrl = envBaseUrl ?? configBaseUrl;
  const modelName = envModelName ?? configModelName;

  // Validate required fields
  if (!baseUrl || !modelName) {
    throw new Error(
      'LLM configuration required: baseUrl and modelName must be set via BROWSEROS_LLM_BASE_URL and BROWSEROS_LLM_MODEL_NAME environment variables, or via BROWSEROS_CONFIG_URL',
    );
  }

  logger.info('Using LLM config', {
    baseUrl,
    modelName,
    apiKeySource: envApiKey ? 'env' : configApiKey ? 'config' : 'none',
  });

  return {
    apiKey,
    baseUrl,
    modelName,
  };
}

async function startAgentServer(
  ports: ReturnType<typeof parseArguments>,
  controllerBridge: ControllerBridge,
): Promise<any> {
  // Register all available agents (Codex SDK, Claude SDK, etc.)
  registerAgents();

  const llmConfig = await getLLMConfig();

  const agentConfig: AgentServerConfig = {
    port: ports.agentPort,
    resourcesDir: ports.resourcesDir,
    executionDir: ports.executionDir,
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
