/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/paths'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { AIProvider } from '../../agent/agent/gemini-vercel-sdk-adapter/types.js'
import {
  formatUIMessageStreamDone,
  formatUIMessageStreamEvent,
} from '../../agent/agent/gemini-vercel-sdk-adapter/ui-message-stream.js'
import { AgentExecutionError } from '../../agent/errors.js'
import type { RateLimiter } from '../../agent/rate-limiter/index.js'
import { SessionManager } from '../../agent/session/SessionManager.js'
import type { Logger } from '../../common/index.js'
import { Sentry } from '../../common/sentry/instrument.js'
import type { ChatRequest } from '../types.js'
import { ChatRequestSchema } from '../types.js'
import { validateRequest } from '../utils/validation.js'

interface ChatRouteDeps {
  logger: Logger
  port: number
  tempDir?: string
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatRoutes(deps: ChatRouteDeps) {
  const { logger, port, tempDir, browserosId, rateLimiter } = deps

  // MCP endpoint is on the same consolidated server
  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`

  // Session manager - one per server instance
  const sessionManager = new SessionManager()

  const chat = new Hono()

  chat.post('/', validateRequest(ChatRequestSchema), async (c) => {
    const request = c.get('validatedBody') as ChatRequest

    const { provider, model, baseUrl } = request

    Sentry.setContext('request', { provider, model, baseUrl })

    logger.info('Chat request received', {
      conversationId: request.conversationId,
      provider: request.provider,
      model: request.model,
      browserContext: request.browserContext,
    })

    // Rate limiting for BrowserOS provider
    if (
      request.provider === AIProvider.BROWSEROS &&
      rateLimiter &&
      browserosId
    ) {
      rateLimiter.check(browserosId)
      rateLimiter.record({
        conversationId: request.conversationId,
        browserosId,
        provider: request.provider,
      })
    }

    c.header('Content-Type', 'text/event-stream')
    c.header('x-vercel-ai-ui-message-stream', 'v1')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    // Create AbortController that we can trigger from multiple sources
    const abortController = new AbortController()
    const abortSignal = abortController.signal

    // Forward raw request abort to our controller
    if (c.req.raw.signal) {
      c.req.raw.signal.addEventListener(
        'abort',
        () => {
          abortController.abort()
        },
        { once: true },
      )
    }

    return stream(c, async (honoStream) => {
      // Register onAbort callback - fires when client disconnects
      honoStream.onAbort(() => {
        abortController.abort()
      })

      try {
        const agent = await sessionManager.getOrCreate({
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
          apiKey: request.apiKey,
          baseUrl: request.baseUrl,
          resourceName: request.resourceName,
          region: request.region,
          accessKeyId: request.accessKeyId,
          secretAccessKey: request.secretAccessKey,
          sessionToken: request.sessionToken,
          contextWindowSize: request.contextWindowSize,
          tempDir: tempDir || PATHS.DEFAULT_TEMP_DIR,
          mcpServerUrl,
          browserosId,
          enabledMcpServers: request.browserContext?.enabledMcpServers,
          customMcpServers: request.browserContext?.customMcpServers,
        })

        const sseStream = {
          write: async (data: string): Promise<void> => {
            await honoStream.write(data)
          },
        }

        await agent.execute(
          request.message,
          sseStream,
          abortSignal,
          request.browserContext,
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Agent execution failed'
        logger.error('Agent execution error', {
          conversationId: request.conversationId,
          error: errorMessage,
        })
        await honoStream.write(
          formatUIMessageStreamEvent({
            type: 'error',
            errorText: errorMessage,
          }),
        )
        await honoStream.write(formatUIMessageStreamDone())
        throw new AgentExecutionError(
          'Agent execution failed',
          error instanceof Error ? error : undefined,
        )
      }
    })
  })

  chat.delete('/:conversationId', (c) => {
    const conversationId = c.req.param('conversationId')
    const deleted = sessionManager.delete(conversationId)

    if (deleted) {
      return c.json({
        success: true,
        message: `Session ${conversationId} deleted`,
        sessionCount: sessionManager.count(),
      })
    }

    return c.json(
      {
        success: false,
        message: `Session ${conversationId} not found`,
      },
      404,
    )
  })

  return chat
}
