/**
 * @license
 * Copyright 2025 BrowserOS
 */
import http from 'node:http';

import type {McpContext, Mutex} from '@browseros/core';
import type {ToolDefinition} from '@browseros/tools';
import {McpResponse} from '@browseros/tools';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {SetLevelRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {z} from 'zod';

/**
 * Configuration for MCP server
 */
export interface McpServerConfig {
  port: number;
  version: string;
  tools: ToolDefinition[];
  context: McpContext;
  toolMutex: Mutex;
  logger: (message: string) => void;
  mcpServerEnabled: boolean;
}

/**
 * Creates an MCP server with registered tools
 * This is the pure MCP logic, separated from HTTP transport
 */
function createMcpServerWithTools(config: McpServerConfig): McpServer {
  const {version, tools, context, toolMutex, logger} = config;

  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    {capabilities: {logging: {}}},
  );

  // Handle logging level requests
  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {};
  });

  // Register each tool with the MCP server
  for (const tool of tools) {
    // Convert ZodRawShape to ZodObject for MCP SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zodSchema = z.object(tool.schema as any);

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: zodSchema as any,
        annotations: tool.annotations,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (params: any): Promise<CallToolResult> => {
        // Serialize tool execution with mutex
        const guard = await toolMutex.acquire();
        try {
          logger(`${tool.name} request: ${JSON.stringify(params, null, '  ')}`);

          // Create response handler and execute tool
          const response = new McpResponse();
          await tool.handler({params}, response, context);

          // Process and return response
          try {
            const content = await response.handle(tool.name, context);
            return {content};
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

  return server;
}

/**
 * Creates HTTP server with MCP endpoint
 * Handles transport and protocol concerns
 */
export function createHttpMcpServer(config: McpServerConfig): http.Server {
  const {port, logger, mcpServerEnabled} = config;

  // Only create MCP server if enabled
  const mcpServer = mcpServerEnabled ? createMcpServerWithTools(config) : null;

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Health check endpoint (always available)
    if (url.pathname === '/health') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
      return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
      // Return disabled status if MCP server is not enabled
      if (!mcpServerEnabled || !mcpServer) {
        res.writeHead(503, {'Content-Type': 'application/json'});
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'MCP server is disabled',
            },
            id: null,
          }),
        );
        return;
      }

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
          void transport.close();
        });

        // Connect the server to this transport
        void mcpServer.connect(transport);

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

  // Handle port binding errors
  httpServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} already in use`);
      process.exit(3);
    }
    console.error(`Error: Failed to bind HTTP server on port ${port}`);
    console.error(error.message);
    process.exit(3);
  });

  // Start listening
  httpServer.listen(port, '127.0.0.1', () => {
    logger(`MCP Server ready at http://127.0.0.1:${port}/mcp`);
  });

  return httpServer;
}

/**
 * Gracefully shuts down the MCP server
 */
export async function shutdownMcpServer(
  server: http.Server,
  logger: (message: string) => void,
): Promise<void> {
  return new Promise(resolve => {
    logger('Closing HTTP server');
    server.close(() => {
      logger('HTTP server closed');
      resolve();
    });
  });
}
