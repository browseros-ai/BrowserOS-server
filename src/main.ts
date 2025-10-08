/**
 * @license
 * Copyright 2025 BrowserOS
 */
import './polyfill.js';

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {SetLevelRequestSchema} from '@modelcontextprotocol/sdk/types.js';

import {parseArguments} from './args.js';
import {ensureBrowserConnected} from './browser.js';
import {createHTTPServer, shutdownHTTPServer} from './http-server.js';
import {logger} from './logger.js';
import {McpContext} from './McpContext.js';
import {McpResponse} from './McpResponse.js';
import {Mutex} from './Mutex.js';
import * as consoleTools from './tools/console.js';
import * as emulationTools from './tools/emulation.js';
import * as inputTools from './tools/input.js';
import * as networkTools from './tools/network.js';
import * as pagesTools from './tools/pages.js';
import * as performanceTools from './tools/performance.js';
import * as screenshotTools from './tools/screenshot.js';
import * as scriptTools from './tools/script.js';
import * as snapshotTools from './tools/snapshot.js';
import type {ToolDefinition} from './tools/ToolDefinition.js';

function readPackageJson(): {version?: string} {
  const currentDir = import.meta.dirname;
  const packageJsonPath = path.join(currentDir, '..', '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }
  try {
    const json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    assert.strict(json['name'], 'browseros-mcp');
    return json;
  } catch {
    return {};
  }
}

const version = readPackageJson().version ?? 'unknown';

const ports = parseArguments();

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

const tools = [
  ...Object.values(consoleTools),
  ...Object.values(emulationTools),
  ...Object.values(inputTools),
  ...Object.values(networkTools),
  ...Object.values(pagesTools),
  ...Object.values(performanceTools),
  ...Object.values(screenshotTools),
  ...Object.values(scriptTools),
  ...Object.values(snapshotTools),
];

const toolMutex = new Mutex();

function createServerWithTools(): McpServer {
  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    {capabilities: {logging: {}}},
  );

  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {};
  });

  function registerTool(tool: ToolDefinition): void {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: tool.annotations,
      },
      async (params): Promise<CallToolResult> => {
        const guard = await toolMutex.acquire();
        try {
          logger(`${tool.name} request: ${JSON.stringify(params, null, '  ')}`);
          const response = new McpResponse();
          await tool.handler(
            {
              params,
            },
            response,
            context,
          );
          try {
            const content = await response.handle(tool.name, context);
            return {
              content,
            };
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error);

            return {
              content: [
                {
                  type: 'text',
                  text: errorText,
                },
              ],
              isError: true,
            };
          }
        } finally {
          guard.dispose();
        }
      },
    );
  }

  for (const tool of tools) {
    registerTool(tool as unknown as ToolDefinition);
  }

  return server;
}

const httpServer = createHTTPServer({
  port: ports.mcpPort,
  version,
  createServer: createServerWithTools,
  logger,
});

console.error(
  `browseros-mcp exposes content of the BrowserOS instance to the MCP clients`,
);

process.on('SIGINT', async () => {
  logger('Shutting down server...');
  await shutdownHTTPServer(httpServer, logger);
  logger('Server shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger('Shutting down server...');
  await shutdownHTTPServer(httpServer, logger);
  logger('Server shutdown complete');
  process.exit(0);
});
