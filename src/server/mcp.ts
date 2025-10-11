/**
 * @license
 * Copyright 2025 BrowserOS
 */
import http from 'node:http';

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {SetLevelRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js';

import type {McpContext} from '../McpContext.js';
import {McpResponse} from '../McpResponse.js';
import type {Mutex} from '../Mutex.js';
import type {ToolDefinition} from '../tools/ToolDefinition.js';

interface Session {
  transport: SSEServerTransport;
  server: McpServer;
}

const sessions = new Map<string, Session>();

export interface McpServerConfig {
  port: number;
  version: string;
  tools: unknown[];
  context: McpContext;
  toolMutex: Mutex;
  logger: (message: string) => void;
}

export function createMcpServer(config: McpServerConfig): http.Server {
  const {port, version, tools, context, toolMutex, logger} = config;

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
            logger(
              `${tool.name} request: ${JSON.stringify(params, null, '  ')}`,
            );
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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found');
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      try {
        const transport = new SSEServerTransport('/mcp', res);
        const mcpServer = createServerWithTools();

        transport.onerror = (error: Error) => {
          logger(
            `Transport error (session ${transport.sessionId}): ${error.message}`,
          );
        };

        transport.onclose = () => {
          sessions.delete(transport.sessionId);
          logger(`SSE connection closed: session ${transport.sessionId}`);
        };

        await mcpServer.connect(transport);

        sessions.set(transport.sessionId, {transport, server: mcpServer});

        logger(`SSE connection established: session ${transport.sessionId}`);
      } catch (error) {
        console.error('Error establishing SSE connection:', error);
        if (!res.headersSent) {
          res.writeHead(500, {'Content-Type': 'text/plain'});
          res.end('Failed to establish SSE connection');
        }
      }
      return;
    }

    if (req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end('Missing sessionId query parameter');
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Session not found');
        return;
      }

      let body = '';

      req.on('error', (error) => {
        console.error('Request stream error:', error);
        if (!res.headersSent) {
          res.writeHead(500, {'Content-Type': 'text/plain'});
          res.end('Request error');
        }
      });

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const parsedBody = JSON.parse(body);
          await session.transport.handlePostMessage(req, res, parsedBody);
        } catch (error) {
          console.error('Error handling POST message:', error);
          if (!res.headersSent) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.end('Internal Server Error');
          }
        }
      });

      return;
    }

    res.writeHead(405, {'Content-Type': 'text/plain'});
    res.end('Method Not Allowed');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} already in use`);
      process.exit(3);
    }
    console.error(`Error: Failed to bind HTTP server on port ${port}`);
    console.error(error.message);
    process.exit(3);
  });

  server.listen(port, '127.0.0.1', () => {
    logger(`MCP Server ready at http://127.0.0.1:${port}/mcp`);
  });

  return server;
}

export async function shutdownMcpServer(
  server: http.Server,
  logger: (message: string) => void,
): Promise<void> {
  return new Promise((resolve) => {
    logger(`Closing ${sessions.size} active sessions`);

    const closePromises: Array<Promise<void>> = [];
    for (const [sessionId, session] of sessions.entries()) {
      closePromises.push(
        session.transport.close().catch(() => {
          /* ignore */
        }),
      );
      sessions.delete(sessionId);
    }

    Promise.all(closePromises).then(() => {
      server.close(() => {
        resolve();
      });
    });
  });
}
