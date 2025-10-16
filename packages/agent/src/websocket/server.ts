/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { z } from 'zod'
import type { ServerWebSocket } from 'bun'
import { Logger } from '../utils/Logger.js'
import { SessionManager } from '../session/SessionManager.js'
import { WebSocketManager } from '@browseros/server/src/controller/WebSocketManager.js'
import {
  tryParseClientMessage,
  type ServerEvent,
  type ConnectionEvent,
  type ErrorEvent
} from './protocol.js'

/**
 * WebSocket data stored per connection
 */
const WebSocketDataSchema = z.object({
  sessionId: z.string().uuid(),
  createdAt: z.number().positive()
})

type WebSocketData = z.infer<typeof WebSocketDataSchema>

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  apiKey: z.string().min(1, 'API key is required'),
  cwd: z.string().min(1, 'Working directory is required'),
  maxSessions: z.number().int().positive(),
  idleTimeoutMs: z.number().positive(),        // Time to wait after agent completion before cleanup
  eventGapTimeoutMs: z.number().positive()     // Max time between consecutive SDK events
})

export type ServerConfig = z.infer<typeof ServerConfigSchema>

/**
 * Server statistics (internal, no validation needed)
 */
interface ServerStats {
  startTime: number
  connections: number
  messagesProcessed: number
}

/**
 * Global server state
 */
const stats: ServerStats = {
  startTime: Date.now(),
  connections: 0,
  messagesProcessed: 0
}

/**
 * Create and start the WebSocket server
 *
 * @param config - Server configuration
 * @param wsManager - Shared WebSocketManager for browser extension connection
 */
export function createServer(config: ServerConfig, wsManager: WebSocketManager) {
  Logger.info('🚀 Starting WebSocket server...', {
    port: config.port,
    maxSessions: config.maxSessions,
    idleTimeoutMs: config.idleTimeoutMs,
    eventGapTimeoutMs: config.eventGapTimeoutMs,
    sharedWebSocketManager: true
  })

  // Create SessionManager with shared WebSocketManager
  const sessionManager = new SessionManager({
    maxSessions: config.maxSessions,
    idleTimeoutMs: config.idleTimeoutMs
  }, wsManager)

  // Track WebSocket connections (needed to close idle sessions)
  const wsConnections = new Map<string, ServerWebSocket<WebSocketData>>()

  // Cleanup idle sessions callback (now async)
  const cleanupIdle = async () => {
    const idleSessionIds = sessionManager.findIdleSessions()

    for (const sessionId of idleSessionIds) {
      const ws = wsConnections.get(sessionId)
      if (ws) {
        Logger.info('🧹 Closing idle session', { sessionId })
        ws.close(1001, 'Idle timeout')
        wsConnections.delete(sessionId)
      }
      await sessionManager.deleteSession(sessionId)
    }
  }

  // Run cleanup check with the timer
  setInterval(cleanupIdle, 60000)

  // @ts-expect-error - Bun's type signature expects 2 args but works fine with 1
  const server = Bun.serve<WebSocketData>({
    port: config.port,

    /**
     * HTTP request handler (for health check and upgrade)
     */
    async fetch(req, server) {
      const url = new URL(req.url)

      // Health check endpoint
      if (url.pathname === '/health') {
        return handleHealthCheck(sessionManager)
      }

      // WebSocket upgrade
      if (req.headers.get('upgrade') === 'websocket') {
        // Check capacity BEFORE upgrading
        if (sessionManager.isAtCapacity()) {
          const capacity = sessionManager.getCapacity()
          Logger.warn('⛔ Connection rejected - server at capacity', {
            active: capacity.active,
            max: capacity.max
          })

          return new Response(
            JSON.stringify({
              error: 'Server at capacity',
              capacity: capacity
            }),
            {
              status: 503,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60'
              }
            }
          )
        }

        // Create session ID before upgrade
        const sessionId = crypto.randomUUID()

        const success = server.upgrade(req, {
          data: {
            sessionId,
            createdAt: Date.now()
          }
        })

        if (success) {
          return undefined
        }

        return new Response('WebSocket upgrade failed', { status: 500 })
      }

      // 404 for other routes
      return new Response('Not Found', { status: 404 })
    },

    /**
     * WebSocket handlers
     */
    websocket: {
      /**
       * Handle new WebSocket connection
       */
      open(ws) {
        const { sessionId, createdAt } = ws.data

        try {
          // Build minimal agent config - defaults will be applied in ClaudeSDKAgent
          const agentConfig = {
            apiKey: config.apiKey,
            cwd: config.cwd
          }

          // Create session with agent
          sessionManager.createSession(
            { id: sessionId },
            agentConfig
          )

          // Track WebSocket connection
          wsConnections.set(sessionId, ws)

          stats.connections++

          Logger.info('✅ Client connected', {
            sessionId,
            activeSessions: sessionManager.getMetrics().activeSessions
          })

          // Send connection confirmation
          const connectionEvent: ConnectionEvent = {
            type: 'connection',
            data: {
              status: 'connected',
              sessionId,
              timestamp: createdAt
            }
          }

          ws.send(JSON.stringify(connectionEvent))
        } catch (error) {
          // Should not happen (capacity checked in fetch)
          Logger.error('❌ Failed to create session', {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          })
          ws.close(1008, 'Failed to create session')
        }
      },

      /**
       * Handle incoming messages from client
       */
      async message(ws, message) {
        const { sessionId } = ws.data

        try {
          // Check if session exists
          if (!sessionManager.hasSession(sessionId)) {
            sendError(ws, 'Session not found')
            ws.close(1008, 'Session not found')
            return
          }

          // Try to mark session as processing (reject if already processing)
          if (!sessionManager.markProcessing(sessionId)) {
            sendError(ws, 'Session is already processing a message. Please wait.')
            return
          }

          // Parse message
          const messageStr = typeof message === 'string'
            ? message
            : new TextDecoder().decode(message)

          Logger.debug('📥 Message received', { sessionId, message: messageStr })

          // Parse and validate
          const parsedData = JSON.parse(messageStr)
          const clientMessage = tryParseClientMessage(parsedData)

          if (!clientMessage) {
            sessionManager.markIdle(sessionId) // Mark idle before returning
            sendError(ws, 'Invalid message format')
            return
          }

          // Update stats
          stats.messagesProcessed++

          // Process the message with Claude SDK
          try {
            await processMessage(ws, clientMessage.content, config, sessionManager)

            // Mark session as idle after successful processing
            sessionManager.markIdle(sessionId)

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)

            // Check for event gap timeout
            if (errorMsg.includes('Event gap timeout')) {
              Logger.error('⏱️ Agent timeout - deleting session', {
                sessionId,
                timeout: config.eventGapTimeoutMs
              })

              // Send error to client
              sendError(ws, `⏱️ Agent timeout: No activity for ${config.eventGapTimeoutMs / 1000}s`)

              // Immediately delete session and close connection (now async)
              await sessionManager.deleteSession(sessionId)
              wsConnections.delete(sessionId)
              ws.close(1008, 'Agent timeout - no activity')
              return
            }

            // Other errors - mark idle normally
            sessionManager.markIdle(sessionId)
            throw error
          }

        } catch (error) {
          Logger.error('❌ Error processing message', {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })

          // Mark session as idle on error
          sessionManager.markIdle(sessionId)

          sendError(ws, 'Error processing message: ' + (error instanceof Error ? error.message : String(error)))
        }
      },

      /**
       * Handle WebSocket close
       */
      async close(ws, code, reason) {
        const { sessionId } = ws.data

        // Delete session from manager (now async)
        await sessionManager.deleteSession(sessionId)

        // Remove WebSocket tracking
        wsConnections.delete(sessionId)

        Logger.info('👋 Client disconnected', {
          sessionId,
          code,
          reason: reason || 'No reason provided',
          remainingSessions: sessionManager.getMetrics().activeSessions
        })
      },

      /**
       * Handle WebSocket error
       */
      error(ws: ServerWebSocket<WebSocketData>, error: Error) {
        const { sessionId } = ws.data

        Logger.error('❌ WebSocket error', {
          sessionId,
          error: error.message
        })
      }
    }
  })

  Logger.info(`✅ Server started on port ${config.port}`)
  Logger.info(`   WebSocket: ws://localhost:${config.port}`)
  Logger.info(`   Health: http://localhost:${config.port}/health`)

  return server
}

/**
 * Process a message through ClaudeSDKAgent and stream events back
 */
async function processMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string,
  config: ServerConfig,
  sessionManager: SessionManager
) {
  const { sessionId } = ws.data

  Logger.info('🤖 Processing with agent...', { sessionId, message })

  try {
    // Get agent for this session
    const agent = sessionManager.getAgent(sessionId)
    if (!agent) {
      throw new Error('Agent not found for session')
    }

    let eventCount = 0
    let lastEventType = ''
    let lastEventTime = Date.now()

    // Get async iterator from agent
    const iterator = agent.execute(message)[Symbol.asyncIterator]()

    // Stream events with gap timeout monitoring (SAME AS BEFORE)
    while (true) {
      // Calculate time since last event
      const timeSinceLastEvent = Date.now() - lastEventTime
      const remainingTime = Math.max(1000, config.eventGapTimeoutMs - timeSinceLastEvent)

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('EventGapTimeout'))
        }, remainingTime)
      })

      // Race next event with gap timeout
      let result
      try {
        result = await Promise.race([
          iterator.next(),
          timeoutPromise
        ])
      } catch (timeoutError) {
        // Cleanup iterator
        if (iterator.return) await iterator.return(undefined)
        throw new Error(`Event gap timeout: No activity for ${config.eventGapTimeoutMs / 1000}s`)
      }

      // Check if iteration is done
      if (result.done) break

      // Update last event time
      lastEventTime = Date.now()
      const formattedEvent = result.value  // Already FormattedEvent!

      eventCount++
      lastEventType = formattedEvent.type

      // Send to client (SAME AS BEFORE)
      ws.send(JSON.stringify(formattedEvent.toJSON()))

      Logger.debug('📤 Event sent', {
        sessionId,
        type: formattedEvent.type,
        eventCount
      })
    }

    Logger.info('✅ Message processed successfully', {
      sessionId,
      totalEvents: eventCount,
      lastEventType
    })

  } catch (error) {
    Logger.error('❌ Agent error', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    sendError(ws, 'Agent error: ' + (error instanceof Error ? error.message : String(error)))

    // Re-throw to be caught by outer handler
    throw error
  }
}

/**
 * Send an error event to the client
 */
function sendError(ws: ServerWebSocket<WebSocketData>, error: string) {
  const errorEvent: ErrorEvent = {
    type: 'error',
    error
  }

  ws.send(JSON.stringify(errorEvent))
}

/**
 * Handle health check endpoint
 */
function handleHealthCheck(sessionManager: SessionManager): Response {
  const uptime = Date.now() - stats.startTime
  const capacity = sessionManager.getCapacity()
  const metrics = sessionManager.getMetrics()

  const health = {
    status: 'healthy',
    uptime: uptime,
    sessions: {
      active: capacity.active,
      max: capacity.max,
      available: capacity.available,
      idle: metrics.idleSessions,
      processing: metrics.processingSessions
    },
    stats: {
      totalConnections: stats.connections,
      messagesProcessed: stats.messagesProcessed,
      averageMessagesPerSession: metrics.averageMessageCount
    },
    timestamp: Date.now()
  }

  return new Response(JSON.stringify(health), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
