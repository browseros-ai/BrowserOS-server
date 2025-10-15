/**
 * @license
 * Copyright 2025 BrowserOS
 */
import http from 'node:http';

import type {McpContext, Mutex} from '@browseros/common';
import type {ToolDefinition} from '@browseros/tools';
import {McpResponse} from '@browseros/tools';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {SetLevelRequestSchema} from '@modelcontextprotocol/sdk/types.js';

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
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
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

  // Runtime state - can be toggled via control endpoint
  let mcpEnabled = mcpServerEnabled;

  // Always create MCP server (access controlled via mcpEnabled flag)
  const mcpServer = createMcpServerWithTools(config);

  /**
   * Validates that request originates from localhost
   */
  const isLocalhostRequest = (req: http.IncomingMessage): boolean => {
    // Check 1: Remote address must be localhost
    const remoteAddr = req.socket.remoteAddress;
    const validAddrs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (!remoteAddr || !validAddrs.includes(remoteAddr)) {
      return false;
    }

    // Check 2: Host header must be localhost
    const host = req.headers.host;
    if (!host) return false;

    const hostname = host.split(':')[0];
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
      return false;
    }

    // Check 3: Origin header (if present) must be localhost
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (
          originUrl.hostname !== '127.0.0.1' &&
          originUrl.hostname !== 'localhost'
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // Check 4: Referer header (if present) must be localhost
    const referer = req.headers.referer;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (
          refererUrl.hostname !== '127.0.0.1' &&
          refererUrl.hostname !== 'localhost'
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  };

  /**
   * Handles MCP control endpoint for enabling/disabling
   */
  const handleControlEndpoint = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    if (req.method !== 'POST') {
      res.writeHead(405, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Method not allowed'}));
      return;
    }

    try {
      // Read request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();

      // Parse and validate
      const data = JSON.parse(body);
      if (typeof data.enabled !== 'boolean') {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(
          JSON.stringify({error: 'Invalid request: enabled must be boolean'}),
        );
        return;
      }

      // Update state
      mcpEnabled = data.enabled;
      logger(
        `MCP server ${mcpEnabled ? 'enabled' : 'disabled'} via control endpoint`,
      );

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({success: true, enabled: mcpEnabled}));
    } catch (error) {
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Invalid JSON'}));
    }
  };

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Health check endpoint (always available, no security checks)
    if (url.pathname === '/health') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
      return;
    }

    // Security check for all other endpoints
    if (!isLocalhostRequest(req)) {
      logger(`Rejected non-localhost request from ${req.socket.remoteAddress}`);
      res.writeHead(403, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Forbidden: Only localhost access allowed'}));
      return;
    }

    // Control endpoint
    if (url.pathname === '/mcp/control') {
      await handleControlEndpoint(req, res);
      return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
      if (!mcpEnabled) {
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
