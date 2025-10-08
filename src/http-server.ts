/**
 * @license
 * Copyright 2025 BrowserOS
 */
import http from 'node:http';

import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js';

interface Session {
  transport: SSEServerTransport;
  server: McpServer;
}

const sessions = new Map<string, Session>();

export interface HTTPServerOptions {
  port: number;
  version: string;
  createServer: () => McpServer;
  logger: (message: string) => void;
}

export function createHTTPServer(options: HTTPServerOptions): http.Server {
  const {port, createServer, logger} = options;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

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
        const mcpServer = createServer();

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

export async function shutdownHTTPServer(
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
