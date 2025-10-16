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
import type {ToolDefinition} from '@browseros/tools';
import * as controllerTools from '@browseros/tools/controller-definitions';

import {parseArguments} from './args.js';
import {ControllerContext, WebSocketManager} from '@browseros/controller-server';

const version = readVersion();
const ports = parseArguments();

// Collect all controller tools
function getAllControllerTools(): Array<ToolDefinition<any, any, any>> {
  const tools: Array<ToolDefinition<any, any, any>> = [];

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
  logger(`Starting WebSocket server on port ${ports.extensionPort}...`);
  const wsManager = new WebSocketManager(ports.extensionPort, logger);
  const controllerContext = new ControllerContext(wsManager);

  // Connect to Chrome DevTools Protocol (optional)
  let cdpContext: McpContext | null = null;
  let cdpTools: Array<ToolDefinition<any, any, any>> = [];

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

  logger(`Agent port reserved: ${ports.agentPort} (not yet implemented)`);

  // TODO: Start Agent server when implemented
  // if (ports.agentServerEnabled) {
  //   const agentServer = createAgentServer({
  //     port: ports.agentPort,
  //     tools: allTools,
  //     context,
  //     toolMutex,
  //     logger,
  //   });
  //   logger(`Agent server listening on ws://127.0.0.1:${ports.agentPort}/agent`);
  // }

  // Graceful shutdown handlers
  const shutdown = async () => {
    logger('Shutting down server...');
    await shutdownMcpServer(mcpServer, logger);
    await wsManager.close();
    logger('Server shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
