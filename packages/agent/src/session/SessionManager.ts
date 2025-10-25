/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { z } from 'zod'
import { logger } from '@browseros/common'
import type { AgentConfig } from '../agent/types.js'
import { AgentFactory } from '../agent/AgentFactory.js'
import type { BaseAgent } from '../agent/BaseAgent.js'
import { ControllerBridge } from '@browseros/controller-server'

/**
 * Session state enum
 */
enum SessionState {
  IDLE = 'idle',           // Connected, waiting for messages
  PROCESSING = 'processing', // Actively processing a message
  CLOSING = 'closing',     // Cleanup initiated
  CLOSED = 'closed'        // Fully closed
}

/**
 * Session data model schema
 * Note: Does NOT store WebSocket reference to prevent memory leaks
 */
const SessionSchema = z.object({
  id: z.string().uuid(),
  state: z.nativeEnum(SessionState),
  createdAt: z.number().positive(),
  lastActivity: z.number().positive(),
  messageCount: z.number().nonnegative()
})

type Session = z.infer<typeof SessionSchema>

/**
 * Session metrics for monitoring
 */
const SessionMetricsSchema = z.object({
  totalSessions: z.number().nonnegative(),
  activeSessions: z.number().nonnegative(),
  idleSessions: z.number().nonnegative(),
  processingSessions: z.number().nonnegative(),
  averageMessageCount: z.number().nonnegative()
})

type SessionMetrics = z.infer<typeof SessionMetricsSchema>

/**
 * Session creation options
 */
const CreateSessionOptionsSchema = z.object({
  id: z.string().uuid().optional(),  // Optional: specify sessionId (useful for testing)
  agentType: z.string().min(1).optional()  // Optional: agent type (defaults to 'codex-sdk')
})

type CreateSessionOptions = z.infer<typeof CreateSessionOptionsSchema>

/**
 * Session configuration
 */
const SessionConfigSchema = z.object({
  maxSessions: z.number().positive(),
  idleTimeoutMs: z.number().positive()
})

type SessionConfig = z.infer<typeof SessionConfigSchema>

/**
 * SessionManager - Manages multiple concurrent WebSocket sessions
 *
 * Architecture:
 * - Does NOT store WebSocket references (prevents memory leaks)
 * - Stores session metadata only
 * - Server maintains Map<sessionId, WebSocket> separately
 * - Provides capacity checking and idle session detection
 * - Receives shared ControllerBridge for browser extension connection
 */
export class SessionManager {
  private sessions: Map<string, Session>
  private agents: Map<string, BaseAgent>
  private config: SessionConfig
  private controllerBridge: ControllerBridge
  private cleanupTimerId?: Timer

  constructor(config: SessionConfig, controllerBridge: ControllerBridge) {
    this.sessions = new Map()
    this.agents = new Map()
    this.config = config
    this.controllerBridge = controllerBridge

    logger.info('📦 SessionManager initialized', {
      maxSessions: config.maxSessions,
      idleTimeoutMs: config.idleTimeoutMs,
      sharedControllerBridge: true
    })
  }

  /**
   * Create a new session with an agent
   *
   * @param options - Session creation options (includes optional agentType)
   * @param agentConfig - Agent configuration
   * @returns Session instance
   */
  createSession(
    options?: CreateSessionOptions,
    agentConfig?: AgentConfig
  ): Session {
    // Check capacity first
    if (this.isAtCapacity()) {
      throw new Error(`Server at capacity (max ${this.config.maxSessions} sessions)`)
    }

    const sessionId = options?.id || crypto.randomUUID()
    const now = Date.now()

    const session: Session = {
      id: sessionId,
      state: SessionState.IDLE,
      createdAt: now,
      lastActivity: now,
      messageCount: 0
    }

    // Validate with Zod
    SessionSchema.parse(session)

    this.sessions.set(sessionId, session)

    // Create agent if config provided
    if (agentConfig) {
      try {
        // Use factory to create agent (defaults to 'codex-sdk' if not specified)
        const agentType = options?.agentType || 'codex-sdk'
        const agent = AgentFactory.create(agentType, agentConfig, this.controllerBridge)
        this.agents.set(sessionId, agent)

        logger.info('✅ Session created with agent', {
          sessionId,
          agentType,
          totalSessions: this.sessions.size
        })
      } catch (error) {
        // Cleanup session if agent creation fails
        this.sessions.delete(sessionId)

        logger.error('❌ Failed to create agent for session', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        })

        throw error
      }
    } else {
      logger.info('✅ Session created without agent', {
        sessionId,
        totalSessions: this.sessions.size
      })
    }

    return session
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Get agent for a session
   *
   * @param sessionId - Session ID
   * @returns BaseAgent instance or undefined if not found
   */
  getAgent(sessionId: string): BaseAgent | undefined {
    return this.agents.get(sessionId)
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn('⚠️  Attempted to update activity for non-existent session', { sessionId })
      return
    }

    session.lastActivity = Date.now()

    logger.debug('🔄 Session activity updated', {
      sessionId,
      messageCount: session.messageCount
    })
  }

  /**
   * Mark session as processing a message
   * Note: Does NOT update lastActivity - idle timer only starts after completion
   */
  markProcessing(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // Reject if already processing (prevent concurrent message handling)
    if (session.state === SessionState.PROCESSING) {
      logger.warn('⚠️  Session already processing message', { sessionId })
      return false
    }

    session.state = SessionState.PROCESSING
    session.messageCount++
    // ❌ Removed: session.lastActivity = Date.now()
    // Idle timer starts from markIdle(), not here

    logger.debug('⚙️  Session marked as processing', {
      sessionId,
      messageCount: session.messageCount
    })

    return true
  }

  /**
   * Mark session as idle (done processing)
   * Updates lastActivity - starts the idle timeout countdown
   */
  markIdle(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }

    session.state = SessionState.IDLE
    session.lastActivity = Date.now()  // ✅ Idle timer starts here

    logger.debug('💤 Session marked as idle', { sessionId })
  }

  /**
   * Delete a session and its agent
   *
   * Now async to support agent cleanup
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    // Mark as closed
    session.state = SessionState.CLOSED

    // Destroy agent (NEW)
    const agent = this.agents.get(sessionId)
    if (agent) {
      try {
        await agent.destroy()
        this.agents.delete(sessionId)
        logger.debug('🗑️  Agent destroyed', { sessionId })
      } catch (error) {
        logger.error('❌ Failed to destroy agent', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        })
        // Continue with session deletion even if agent cleanup fails
      }
    }

    // Delete session
    this.sessions.delete(sessionId)

    logger.info('🗑️  Session deleted', {
      sessionId,
      remainingSessions: this.sessions.size,
      messageCount: session.messageCount,
      lifetime: Date.now() - session.createdAt
    })

    return true
  }

  /**
   * Check if server is at capacity
   */
  isAtCapacity(): boolean {
    return this.sessions.size >= this.config.maxSessions
  }

  /**
   * Get current capacity status
   */
  getCapacity(): { active: number; max: number; available: number } {
    const active = this.sessions.size
    const max = this.config.maxSessions
    return {
      active,
      max,
      available: max - active
    }
  }

  /**
   * Find idle sessions that have timed out
   * Returns array of sessionIds to close
   */
  findIdleSessions(): string[] {
    const now = Date.now()
    const idleSessionIds: string[] = []

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivity

      // Only cleanup sessions that are IDLE (not actively processing)
      if (session.state === SessionState.IDLE && idleTime > this.config.idleTimeoutMs) {
        idleSessionIds.push(sessionId)

        logger.info('⏱️  Idle session detected', {
          sessionId,
          idleTimeMs: idleTime,
          threshold: this.config.idleTimeoutMs
        })
      }
    }

    return idleSessionIds
  }

  /**
   * Start periodic cleanup of idle sessions
   * Returns cleanup function to stop the timer
   */
  startCleanup(intervalMs: number = 60000): () => void {
    if (this.cleanupTimerId) {
      logger.warn('⚠️  Cleanup timer already running')
      return () => {}
    }

    logger.info('🧹 Starting periodic session cleanup', { intervalMs })

    this.cleanupTimerId = setInterval(() => {
      const idleSessionIds = this.findIdleSessions()

      if (idleSessionIds.length > 0) {
        logger.info('🧹 Cleanup found idle sessions', {
          count: idleSessionIds.length,
          sessionIds: idleSessionIds
        })
      }

      // Note: Actual WebSocket closing happens in server.ts
      // This just identifies which sessions to close
    }, intervalMs)

    // Return cleanup function
    return () => {
      if (this.cleanupTimerId) {
        clearInterval(this.cleanupTimerId)
        this.cleanupTimerId = undefined
        logger.info('🛑 Session cleanup stopped')
      }
    }
  }

  /**
   * Get session metrics
   */
  getMetrics(): SessionMetrics {
    let idleCount = 0
    let processingCount = 0
    let totalMessages = 0

    for (const session of this.sessions.values()) {
      totalMessages += session.messageCount

      if (session.state === SessionState.IDLE) {
        idleCount++
      } else if (session.state === SessionState.PROCESSING) {
        processingCount++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size,
      idleSessions: idleCount,
      processingSessions: processingCount,
      averageMessageCount: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0
    }
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * Shutdown - cleanup all sessions and agents
   *
   * Now async to support agent cleanup
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 SessionManager shutting down', {
      activeSessions: this.sessions.size,
      activeAgents: this.agents.size
    })

    // Stop cleanup timer
    if (this.cleanupTimerId) {
      clearInterval(this.cleanupTimerId)
      this.cleanupTimerId = undefined
    }

    // Destroy all agents (NEW)
    const destroyPromises: Promise<void>[] = []
    for (const [sessionId, agent] of this.agents) {
      destroyPromises.push(
        agent.destroy().catch((error) => {
          logger.error('❌ Failed to destroy agent during shutdown', {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          })
        })
      )
    }

    await Promise.all(destroyPromises)
    this.agents.clear()

    // Clear all sessions
    this.sessions.clear()

    logger.info('✅ SessionManager shutdown complete')
  }
}
