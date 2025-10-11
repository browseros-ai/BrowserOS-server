/**
 * @license
 * Copyright 2025 BrowserOS
 */
import http from 'node:http';

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {SetLevelRequestSchema} from '@modelcontextprotocol/sdk/types.js';

import type {McpContext} from '../McpContext.js';
import {McpResponse} from '../McpResponse.js';
import type {Mutex} from '../Mutex.js';
import type {ToolDefinition} from '../tools/ToolDefinition.js';

export interface McpServerConfig {
  port: number;
  version: string;
  tools: unknown[];
  context: McpContext;
  toolMutex: Mutex;
  logger: (message: string) => void;
}

function createServerWithTools(config: McpServerConfig): McpServer {
  const {version, tools, context, toolMutex, logger} = config;

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

export function createMcpServer(config: McpServerConfig): http.Server {
  const {port, logger} = config;

  // Create the MCP server once - it will be reused across requests
  const mcpServer = createServerWithTools(config);

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
      return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
      try {
        // Create a new transport for each request to prevent request ID collisions.
        // Different clients may use the same JSON-RPC request IDs, which would cause
        // responses to be routed to the wrong HTTP connections if transport state is shared.
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode - no session management
          enableJsonResponse: true, // Return JSON responses (not SSE streams)
        });

        // Clean up transport when response closes
        res.on('close', () => {
          transport.close();
        });

        // Connect the server to this transport
        await mcpServer.connect(transport);

        // Let the SDK handle the request (it will parse body, validate, and respond)
        await transport.handleRequest(req, res);
      } catch (error) {
        logger(`Error handling MCP request: ${error}`);
        if (!res.headersSent) {
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            }),
          );
        }
      }
      return;
    }

    // 404 for other paths
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
  });

  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} already in use`);
      process.exit(3);
    }
    console.error(`Error: Failed to bind HTTP server on port ${port}`);
    console.error(error.message);
    process.exit(3);
  });

  httpServer.listen(port, '127.0.0.1', () => {
    logger(`MCP Server ready at http://127.0.0.1:${port}/mcp`);
  });

  return httpServer;
}

export async function shutdownMcpServer(
  server: http.Server,
  logger: (message: string) => void,
): Promise<void> {
  return new Promise((resolve) => {
    logger('Closing HTTP server');
    server.close(() => {
      logger('HTTP server closed');
      resolve();
    });
  });
}
