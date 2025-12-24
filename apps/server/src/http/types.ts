/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RateLimiter } from '../agent/rate-limiter/index.js'
import type { Logger, McpContext, Mutex } from '../common/index.js'
import type { ControllerContext } from '../controller-server/index.js'
import type { ToolDefinition } from '../tools/index.js'

/**
 * Hono environment bindings for Bun.serve integration.
 * The server binding is required for security checks (isLocalhostRequest).
 */
export type Env = {
  Bindings: {
    server: ReturnType<typeof Bun.serve>
  }
  Variables: AppVariables
}

/**
 * Request-scoped variables set by middleware.
 */
export interface AppVariables {
  validatedBody: unknown
}

/**
 * Configuration for the consolidated HTTP server.
 * This server handles all routes: health, klavis, chat, mcp, provider
 */
export interface HttpServerConfig {
  // Server basics
  port: number
  host?: string
  logger: Logger

  // For MCP routes - server will create McpServer internally
  version: string
  tools: ToolDefinition[]
  cdpContext: McpContext | null
  controllerContext: ControllerContext
  toolMutex: Mutex
  allowRemote: boolean

  // For Chat/Klavis routes
  browserosId?: string
  tempDir?: string
  rateLimiter?: RateLimiter
}
