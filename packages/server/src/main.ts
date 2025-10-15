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
import {allTools} from '@browseros/tools';
import * as controllerTools from '@browseros/tools/controller-definitions';
import type {ToolDefinition} from '@browseros/tools';
import {createAgentServer, type AgentServerConfig} from '@browseros/agent';

import {parseArguments} from './args.js';
import {WebSocketManager} from './controller/WebSocketManager.js';
import {ControllerContext} from './controller/ControllerContext.js';

const version = readVersion();
const ports = parseArguments();

// Collect all controller tools
function getAllControllerTools(): ToolDefinition<any, any, any>[] {
  const tools: ToolDefinition<any, any, any>[] = [];

  for (const [key, value] of Object.entries(controllerTools)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'handler' in value
    ) {
      tools.push(value as ToolDefinition<any, any, any>);
    }
  }

  return tools;
}

void (async () => {
  logger(`Starting BrowserOS Server v${version}`);

  // Start WebSocket server for extension
  logger(`Starting WebSocket server on port ${ports.wsPort}...`);
  const wsManager = new WebSocketManager(ports.wsPort, logger);
  const controllerContext = new ControllerContext(wsManager);

  // Connect to Chrome DevTools Protocol (optional)
  let cdpContext: McpContext | null = null;
  let cdpTools: ToolDefinition<any, any, any>[] = [];

  if (ports.cdpPort) {
    try {
      const browser = await ensureBrowserConnected(
        `http://127.0.0.1:${ports.cdpPort}`,
      );
      logger(`Connected to CDP at http://127.0.0.1:${ports.cdpPort}`);
      cdpContext = await McpContext.from(browser, logger);
      cdpTools = allTools;
      logger(`Loaded ${cdpTools.length} CDP tools`);
    } catch (error) {
      logger(`Warning: Could not connect to CDP at http://127.0.0.1:${ports.cdpPort}`);
      logger('CDP tools will not be available. Only extension tools will work.');
    }
  } else {
    logger('CDP disabled (no --cdp-port specified). Only extension tools will be available.');
  }

  // Collect all controller tools
  const extensionTools = getAllControllerTools();
  logger(`Loaded ${extensionTools.length} controller (extension) tools`);

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

  logger(`Total tools available: ${mergedTools.length} (${cdpTools.length} CDP + ${extensionTools.length} extension)`);

  // Create shared tool mutex
  const toolMutex = new Mutex();

  // Start MCP server with all tools
  // Use cdpContext if available, otherwise create a dummy context (won't be used for extension tools)
  const mcpServer = createHttpMcpServer({
    port: ports.httpMcpPort,
    version,
    tools: mergedTools,
    context: cdpContext || {} as any, // Dummy context if CDP not available
    controllerContext, // Pass controller context for browser_* tools
    toolMutex,
    logger,
    mcpServerEnabled: ports.mcpServerEnabled,
  });

  if (!ports.mcpServerEnabled) {
    logger('MCP server disabled (--disable-mcp-server)');
  } else {
    logger(`MCP server listening on http://127.0.0.1:${ports.httpMcpPort}/mcp`);
  }

  logger(
    `Health check available at http://127.0.0.1:${ports.httpMcpPort}/health`,
  );

  // Start Agent WebSocket server with shared WebSocketManager
  let agentServer: any = null;
  if (ports.agentServerEnabled) {
    // Check for required environment variables
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger('Warning: ANTHROPIC_API_KEY not set. Agent server will be disabled.');
      logger('Set ANTHROPIC_API_KEY environment variable to enable agent functionality.');
    } else {
      console.log('[DEBUG] API key found, creating agent config...');
      try {
        const agentConfig: AgentServerConfig = {
          port: ports.agentPort,
          apiKey,
          cwd: process.cwd(),
          maxSessions: parseInt(process.env.MAX_SESSIONS || '5'),
          idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '90000'),
          eventGapTimeoutMs: parseInt(process.env.EVENT_GAP_TIMEOUT_MS || '60000')
        };
        // Create agent server with shared WebSocketManager
        agentServer = createAgentServer(agentConfig, wsManager);
      } catch (error) {
        logger(`Agent server creation failed: ${error}`);
        logger('Agent server will be disabled.');
      }
    }
  } else {
    logger('Agent server disabled (--disable-agent-server)');
  }

  // Graceful shutdown handlers
  const shutdown = async () => {
    logger('Shutting down server...');

    // Shutdown MCP server first
    await shutdownMcpServer(mcpServer, logger);

    // Shutdown agent server if it's running
    if (agentServer) {
      logger('Stopping agent server...');
      agentServer.stop();
    }

    // Close WebSocketManager LAST (after both MCP and Agent are stopped)
    logger('Closing WebSocketManager...');
    await wsManager.close();

    logger('Server shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
