/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Hono } from 'hono'
import type { z } from 'zod'
import type { Logger, McpContext, Mutex } from '../../common/index.js'
import { metrics } from '../../common/index.js'
import { Sentry } from '../../common/sentry/instrument.js'
import type { ControllerContext } from '../../controller-server/index.js'
import type { ToolDefinition } from '../../tools/index.js'
import { McpResponse } from '../../tools/index.js'
import type { Env } from '../types.js'
import { isLocalhostRequest } from '../utils/security.js'

interface McpRouteDeps {
  version: string
  tools: ToolDefinition[]
  cdpContext: McpContext | null
  controllerContext: ControllerContext
  toolMutex: Mutex
  logger: Logger
  allowRemote: boolean
}

/**
 * Creates an MCP server with registered tools.
 * Reuses the same logic from the old mcp/server.ts
 */
function createMcpServerWithTools(deps: McpRouteDeps): McpServer {
  const { version, tools, cdpContext, controllerContext, toolMutex, logger } =
    deps

  const server = new McpServer(
    {
      name: 'browseros_mcp',
      title: 'BrowserOS MCP server',
      version,
    },
    { capabilities: { logging: {} } },
  )

  // Handle logging level requests
  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {}
  })

  // Register each tool with the MCP server
  for (const tool of tools) {
    // @ts-expect-error TS2589: Type instantiation too deep with complex Zod schema generics
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema as z.ZodRawShape,
        annotations: tool.annotations,
      },
      (async (params: Record<string, unknown>): Promise<CallToolResult> => {
        const startTime = performance.now()

        // Serialize tool execution with mutex
        const guard = await toolMutex.acquire()
        try {
          logger.info(
            `${tool.name} request: ${JSON.stringify(params, null, '  ')}`,
          )

          // Detect if this is a controller tool (browser_* tools)
          const isControllerTool = tool.name.startsWith('browser_')
          const contextForResponse =
            isControllerTool && controllerContext
              ? controllerContext
              : cdpContext

          // Create response handler and execute tool
          const response = new McpResponse()
          await tool.handler({ params }, response, cdpContext)

          // Process and return response
          try {
            const content = await response.handle(
              tool.name,
              contextForResponse as McpContext,
            )

            // Log successful tool execution (non-blocking)
            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: true,
            })

            const structuredContent = response.structuredContent
            return {
              content,
              ...(structuredContent && { structuredContent }),
            }
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error)

            // Log failed tool execution (non-blocking)
            metrics.log('tool_executed', {
              tool_name: tool.name,
              duration_ms: Math.round(performance.now() - startTime),
              success: false,
              error_message:
                error instanceof Error ? error.message : 'Unknown error',
            })

            return {
              content: [{ type: 'text', text: errorText }],
              isError: true,
            }
          }
        } finally {
          guard.dispose()
        }
      }) as (params: Record<string, unknown>) => Promise<CallToolResult>,
    )
  }

  return server
}

export function createMcpRoutes(deps: McpRouteDeps) {
  const { logger, allowRemote } = deps

  // Create MCP server once with all tools registered
  const mcpServer = createMcpServerWithTools(deps)

  return new Hono<Env>().all('/', async (c) => {
    // Security check: localhost only (unless allowRemote is enabled)
    if (!allowRemote && !isLocalhostRequest(c)) {
      logger.warn('Rejected non-localhost MCP request')
      return c.json({ error: 'Forbidden: Only localhost access allowed' }, 403)
    }

    try {
      // Create a new transport for EACH request to prevent request ID collisions.
      // Different clients may use the same JSON-RPC request IDs, which would cause
      // responses to be routed to the wrong HTTP connections if transport state is shared.
      const transport = new StreamableHTTPTransport({
        sessionIdGenerator: undefined, // Stateless mode - no session management
        enableJsonResponse: true, // Return JSON responses (not SSE streams)
      })

      // Connect the server to this transport
      await mcpServer.connect(transport)

      // Handle the request and return response
      return transport.handleRequest(c)
    } catch (error) {
      Sentry.captureException(error)
      logger.error('Error handling MCP request', {
        error: error instanceof Error ? error.message : String(error),
      })

      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        },
        500,
      )
    }
  })
}
