/**
 * @license
 * Copyright 2025 BrowserOS
 */
import './polyfill.js';

import {parseArguments} from './args.js';
import {ensureBrowserConnected} from './browser.js';
import {logger} from './logger.js';
import {McpContext} from './McpContext.js';
import {Mutex} from './Mutex.js';
import {createMcpServer, shutdownMcpServer} from './server/mcp.js';
import {allTools} from './tools/index.js';
import {readVersion} from './utils/util.js';

const version = readVersion();
const ports = parseArguments();

(async () => {
  logger(`Starting BrowserOS MCP Server v${version}`);

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

  const toolMutex = new Mutex();

  const server = createMcpServer({
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
  logger('Connected to cdp on port: ' + ports.cdpPort);
  logger(
    `Health check available at http://127.0.0.1:${ports.httpMcpPort}/health`,
  );

  process.on('SIGINT', async () => {
    logger('Shutting down server...');
    await shutdownMcpServer(server, logger);
    logger('Server shutdown complete');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger('Shutting down server...');
    await shutdownMcpServer(server, logger);
    logger('Server shutdown complete');
    process.exit(0);
  });
})();
