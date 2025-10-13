/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main server orchestration
 */
import { parseArguments } from './args.js';
import { ensureBrowserConnected, McpContext, Mutex, logger, readVersion } from '@browseros/core';
import { allTools } from '@browseros/tools';
import { createHttpMcpServer, shutdownMcpServer } from '@browseros/mcp-server';

const version = readVersion();
const ports = parseArguments();

(async () => {
  logger(`Starting BrowserOS Server v${version}`);

  // Connect to Chrome DevTools Protocol
  let context: McpContext;
  try {
    const browser = await ensureBrowserConnected(
      `http://127.0.0.1:${ports.cdpPort}`,
    );
    logger(`Connected to CDP at http://127.0.0.1:${ports.cdpPort}`);
    context = await McpContext.from(browser, logger);
  } catch (error) {
    console.error(
      `Error: Failed to connect to CDP at http://127.0.0.1:${ports.cdpPort}`,
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  // Create shared tool mutex
  const toolMutex = new Mutex();

  // Start MCP server
  const mcpServer = createHttpMcpServer({
    port: ports.httpMcpPort,
    version,
    tools: allTools,
    context,
    toolMutex,
    logger,
    mcpServerEnabled: ports.mcpServerEnabled,
  });

  if (!ports.mcpServerEnabled) {
    logger('MCP server disabled (--disable-mcp-server)');
  } else {
    logger(`MCP server listening on http://127.0.0.1:${ports.httpMcpPort}/mcp`);
  }

  logger(`Health check available at http://127.0.0.1:${ports.httpMcpPort}/health`);

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
  process.on('SIGINT', async () => {
    logger('Shutting down server...');
    await shutdownMcpServer(mcpServer, logger);
    // TODO: Shutdown agent server
    logger('Server shutdown complete');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger('Shutting down server...');
    await shutdownMcpServer(mcpServer, logger);
    // TODO: Shutdown agent server
    logger('Server shutdown complete');
    process.exit(0);
  });
})();