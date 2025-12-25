/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Consolidated HTTP Server
 *
 * This server combines:
 * - Agent HTTP routes (chat, klavis, provider)
 * - MCP HTTP routes (using @hono/mcp transport)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HttpAgentError } from '../agent/errors.js'
import { createChatRoutes } from './routes/chat.js'
import { createExtensionStatusRoute } from './routes/extension-status.js'
import { health } from './routes/health.js'
import { createKlavisRoutes } from './routes/klavis.js'
import { createMcpRoutes } from './routes/mcp.js'
import { createProviderRoutes } from './routes/provider.js'
import type { Env, HttpServerConfig } from './types.js'
import { defaultCorsConfig } from './utils/cors.js'

/**
 * Creates the consolidated HTTP server.
 *
 * @param config - Server configuration
 * @returns Bun server instance
 */
export function createHttpServer(config: HttpServerConfig) {
  const {
    port,
    host = '0.0.0.0',
    logger: log,
    browserosId,
    tempDir,
    rateLimiter,
    version,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
    allowRemote,
  } = config

  // DECLARATIVE route composition - chain .route() calls for type inference
  const app = new Hono<Env>()
    .use('/*', cors(defaultCorsConfig))
    .route('/health', health)
    .route(
      '/extension-status',
      createExtensionStatusRoute({ controllerContext }),
    )
    .route('/test-provider', createProviderRoutes({ logger: log }))
    .route(
      '/klavis',
      createKlavisRoutes({ browserosId: browserosId || '', logger: log }),
    )
    .route(
      '/mcp',
      createMcpRoutes({
        version,
        tools,
        cdpContext,
        controllerContext,
        toolMutex,
        logger: log,
        allowRemote,
      }),
    )
    .route(
      '/chat',
      createChatRoutes({
        logger: log,
        port,
        tempDir,
        browserosId,
        rateLimiter,
      }),
    )

  // Error handler
  app.onError((err, c) => {
    const error = err as Error

    if (error instanceof HttpAgentError) {
      log.warn('HTTP Agent Error', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      })
      return c.json(error.toJSON(), error.statusCode as ContentfulStatusCode)
    }

    log.error('Unhandled Error', {
      message: error.message,
      stack: error.stack,
    })

    return c.json(
      {
        error: {
          name: 'InternalServerError',
          message: error.message || 'An unexpected error occurred',
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
        },
      },
      500,
    )
  })

  // IMPORTANT: Pass Bun server to Hono env for isLocalhostRequest() security check.
  // This allows routes to access server.requestIP() for real TCP connection IP.
  const server = Bun.serve({
    fetch: (request, server) => app.fetch(request, { server }),
    port,
    hostname: host,
    idleTimeout: 0, // Disable idle timeout for long-running LLM streams
  })

  log.info('Consolidated HTTP Server started', { port, host })

  return {
    app,
    server,
    config,
  }
}

// Export type for client inference (e.g., hono/client)
export type AppType = ReturnType<typeof createHttpServer>['app']
