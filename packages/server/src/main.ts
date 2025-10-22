/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
import {
  ensureBrowserConnected,
  McpContext,
  Mutex,
  logger,
  readVersion,
} from '@browseros/common';
import {createHttpMcpServer, shutdownMcpServer} from '@browseros/mcp';
import {allCdpTools, allControllerTools, type ToolDefinition} from '@browseros/tools';
import {createAgentServer, type AgentServerConfig} from '@browseros/agent';

import {parseArguments} from './args.js';
import {
  ControllerContext,
  ControllerBridge,
} from '@browseros/controller-server';

const version = readVersion();
const ports = parseArguments();

void (async () => {
  logger.info(`Starting BrowserOS Server v${version}`);

  // Start WebSocket server for extension
  logger.info(
    `[Controller Server] Starting on ws://127.0.0.1:${ports.extensionPort}`,
  );
  const controllerBridge = new ControllerBridge(ports.extensionPort, logger);
  const controllerContext = new ControllerContext(controllerBridge);

  // Connect to Chrome DevTools Protocol (optional)
  let cdpContext: McpContext | null = null;
  let cdpTools: Array<ToolDefinition<any, any, any>> = [];

  if (ports.cdpPort) {
    try {
      const browser = await ensureBrowserConnected(
        `http://127.0.0.1:${ports.cdpPort}`,
      );
      logger.info(`Connected to CDP at http://127.0.0.1:${ports.cdpPort}`);
      cdpContext = await McpContext.from(browser, logger);
      cdpTools = allCdpTools;
      logger.info(`Loaded ${cdpTools.length} CDP tools`);
    } catch (error) {
      logger.warn(
        `Warning: Could not connect to CDP at http://127.0.0.1:${ports.cdpPort}`,
      );
      logger.warn(
        'CDP tools will not be available. Only extension tools will work.',
      );
    }
  } else {
    logger.info(
      'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
    );
  }

  // Use all controller tools from package
  const extensionTools = allControllerTools;
  logger.info(`Loaded ${extensionTools.length} controller (extension) tools`);

  // Merge CDP tools and controller tools
  const mergedTools = [
    ...cdpTools, // CDP tools (empty if CDP not available)
    ...extensionTools.map((tool: any) => ({
      ...tool,
      // Wrap handler to use controller context
      handler: async (request: any, response: any, _context: any) => {
        return tool.handler(request, response, controllerContext);
      },
    })),
  ];

  logger.info(
    `Total tools available: ${mergedTools.length} (${cdpTools.length} CDP + ${extensionTools.length} extension)`,
  );

  // Create shared tool mutex
  const toolMutex = new Mutex();

  // Start MCP server with all tools
  // Use cdpContext if available, otherwise create a dummy context (won't be used for extension tools)
  const mcpServer = createHttpMcpServer({
    port: ports.httpMcpPort,
    version,
    tools: mergedTools,
    context: cdpContext || ({} as any), // Dummy context if CDP not available
    controllerContext, // Pass controller context for browser_* tools
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

  // Start Agent WebSocket server with shared ControllerBridge
  let agentServer: any = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('[Agent Server] ANTHROPIC_API_KEY not set - skipping');
  } else {
    try {
      const agentConfig: AgentServerConfig = {
        port: ports.agentPort,
        apiKey,
        cwd: process.cwd(),
        maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
        idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '90000'),
        eventGapTimeoutMs: parseInt(
          process.env.EVENT_GAP_TIMEOUT_MS || '60000',
        ),
      };

      agentServer = createAgentServer(agentConfig, controllerBridge);

      logger.info(`[Agent Server] Listening on ws://127.0.0.1:${ports.agentPort}`);
      logger.info(
        `[Agent Server] Max sessions: ${agentConfig.maxSessions}, Idle timeout: ${agentConfig.idleTimeoutMs}ms`,
      );
    } catch (error) {
      logger.error(
        `[Agent Server] Failed to start: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info('');
  logger.info('Services running:');
  logger.info(`  Controller Server: ws://127.0.0.1:${ports.extensionPort}`);
  if (ports.mcpServerEnabled) {
    logger.info(`  MCP Server: http://127.0.0.1:${ports.httpMcpPort}/mcp`);
  }
  if (agentServer) {
    logger.info(`  Agent Server: ws://127.0.0.1:${ports.agentPort}`);
  }
  logger.info('');

  // Graceful shutdown handlers
  const shutdown = async () => {
    logger.info('Shutting down server...');

    // Shutdown MCP server first
    await shutdownMcpServer(mcpServer, logger);

    // Shutdown agent server if it's running
    if (agentServer) {
      logger.info('Stopping agent server...');
      agentServer.stop();
    }

    // Close ControllerBridge LAST (after both MCP and Agent are stopped)
    logger.info('Closing ControllerBridge...');
    await controllerBridge.close();

    logger.info('Server shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
