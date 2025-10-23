/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { EventFormatter, FormattedEvent } from '../utils/EventFormatter.js'
import { logger, fetchBrowserOSConfig, type BrowserOSConfig } from '@browseros/common'
import type { AgentConfig } from './types.js'
import { BaseAgent } from './BaseAgent.js'
import { CLAUDE_SDK_SYSTEM_PROMPT } from './ClaudeSDKAgent.prompt.js'
import { allControllerTools } from '@browseros/tools/controller-based'
import type { ToolDefinition } from '@browseros/tools'
import { ControllerBridge, ControllerContext } from '@browseros/controller-server'
import { createControllerMcpServer } from './ControllerToolsAdapter.js'

/**
 * Claude SDK specific default configuration
 */
const CLAUDE_SDK_DEFAULTS = {
  maxTurns: 100,
  maxThinkingTokens: 10000,
  permissionMode: 'bypassPermissions' as const
}

/**
 * Claude SDK Agent implementation
 *
 * Wraps @anthropic-ai/claude-agent-sdk with:
 * - In-process SDK MCP server with controller tools
 * - Shared ControllerBridge for browseros-controller connection
 * - Event formatting via EventFormatter
 * - AbortController for cleanup
 * - Metadata tracking
 *
 * Note: Requires external ControllerBridge (provided by main server)
 */
export class ClaudeSDKAgent extends BaseAgent {
  private abortController: AbortController | null = null
  private gatewayConfig: BrowserOSConfig | null = null

  constructor(config: AgentConfig, controllerBridge: ControllerBridge) {
    logger.info('🔧 Using shared ControllerBridge for controller connection')

    const controllerContext = new ControllerContext(controllerBridge)

    // Get all controller tools from package and create SDK MCP server
    const sdkMcpServer = createControllerMcpServer(allControllerTools, controllerContext)

    logger.info(`✅ Created SDK MCP server with ${allControllerTools.length} controller tools`)

    // Pass Claude SDK specific defaults to BaseAgent (must call super before accessing this)
    super('claude-sdk', config, {
      systemPrompt: CLAUDE_SDK_SYSTEM_PROMPT,
      mcpServers: { 'browseros-controller': sdkMcpServer },
      maxTurns: CLAUDE_SDK_DEFAULTS.maxTurns,
      maxThinkingTokens: CLAUDE_SDK_DEFAULTS.maxThinkingTokens,
      permissionMode: CLAUDE_SDK_DEFAULTS.permissionMode
    })

    logger.info('✅ ClaudeSDKAgent initialized with shared ControllerBridge')
  }

  /**
   * Initialize agent - fetch config from BrowserOS Config URL if configured
   * Falls back to ANTHROPIC_API_KEY env var if config URL not set or fails
   */
  override async init(): Promise<void> {
    const configUrl = process.env.BROWSEROS_CONFIG_URL

    if (configUrl) {
      logger.info('🌐 Fetching config from BrowserOS Config URL', { configUrl })

      try {
        this.gatewayConfig = await fetchBrowserOSConfig(configUrl)
        this.config.apiKey = this.gatewayConfig.apiKey

        logger.info('✅ Using API key from BrowserOS Config URL', {
          model: this.gatewayConfig.model
        })

        await super.init()
        return
      } catch (error) {
        logger.warn('⚠️  Failed to fetch from config URL, falling back to ANTHROPIC_API_KEY', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const envApiKey = process.env.ANTHROPIC_API_KEY
    if (envApiKey) {
      this.config.apiKey = envApiKey
      logger.info('✅ Using API key from ANTHROPIC_API_KEY env var')
      await super.init()
      return
    }

    throw new Error(
      'No API key found. Set either BROWSEROS_CONFIG_URL or ANTHROPIC_API_KEY'
    )
  }

  /**
   * Wrapper around iterator.next() that yields heartbeat events while waiting
   * @param iterator - The async iterator
   * @yields Heartbeat events (FormattedEvent) and the final iterator result (IteratorResult)
   */
  private async *nextWithHeartbeat(iterator: AsyncIterator<any>): AsyncGenerator<any> {
    const heartbeatInterval = 20000 // 20 seconds
    let heartbeatTimer: NodeJS.Timeout | null = null
    let iteratorPromise = iterator.next()

    try {
      while (true) {
        // Check if execution was aborted
        if (this.abortController?.signal.aborted) {
          logger.info('⚠️  Agent execution aborted during heartbeat wait')
          return
        }

        const timeoutPromise = new Promise(resolve => {
          heartbeatTimer = setTimeout(() => resolve({ type: 'heartbeat' }), heartbeatInterval)
        })

        // Create abort promise that rejects when abort signal is triggered
        const abortPromise = new Promise<never>((_, reject) => {
          if (this.abortController) {
            const abortHandler = () => {
              reject(new Error('Agent execution aborted by client'))
            }
            // Listen for abort signal
            this.abortController.signal.addEventListener('abort', abortHandler, { once: true })
          }
        })

        type RaceResult = { type: 'result'; result: any } | { type: 'heartbeat' }
        let race: RaceResult
        try {
          race = await Promise.race([
            iteratorPromise.then(result => ({ type: 'result' as const, result })),
            timeoutPromise.then(() => ({ type: 'heartbeat' as const })),
            abortPromise
          ])
        } catch (abortError) {
          // Abort was triggered during wait
          logger.info('⚠️  Agent execution aborted (caught during iterator wait)')
          // Cleanup iterator
          if (iterator.return) {
            await iterator.return(undefined).catch(() => {})
          }
          return
        }

        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer)
          heartbeatTimer = null
        }

        if (race.type === 'heartbeat') {
          yield EventFormatter.createProcessingEvent()
        } else {
          // Yield the iterator result (not return!) so the consumer receives it
          yield race.result
          return
        }
      }
    } finally {
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
    }
  }

  /**
   * Execute a task using Claude SDK and stream formatted events
   *
   * @param message - User's natural language request
   * @yields FormattedEvent instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    if (!this.initialized) {
      await this.init()
    }

    this.startExecution()
    this.abortController = new AbortController()

    logger.info('🤖 ClaudeSDKAgent executing', { message: message.substring(0, 100) })

    try {
      const options: any = {
        apiKey: this.config.apiKey,
        maxTurns: this.config.maxTurns,
        maxThinkingTokens: this.config.maxThinkingTokens,
        cwd: this.config.cwd,
        systemPrompt: this.config.systemPrompt,
        mcpServers: this.config.mcpServers,
        permissionMode: this.config.permissionMode,
        abortController: this.abortController
      }

      if (this.gatewayConfig?.model) {
        options.model = this.gatewayConfig.model
        logger.debug('Using model from gateway', { model: this.gatewayConfig.model })
      }

      // Call Claude SDK
      const iterator = query({ prompt: message, options })[Symbol.asyncIterator]()

      // Stream events with heartbeat
      while (true) {
        // Check if execution was aborted
        if (this.abortController?.signal.aborted) {
          logger.info('⚠️  Agent execution aborted by client')
          break
        }

        let result: IteratorResult<any> | null = null

        // Iterate through heartbeat generator to get the actual result
        for await (const item of this.nextWithHeartbeat(iterator)) {
          if (item && item.done !== undefined) {
            // This is the final result
            result = item
          } else {
            // This is a heartbeat/processing event
            yield item
          }
        }

        if (!result || result.done) break

        const event = result.value

        // Update event time
        this.updateEventTime()

        // Track tool executions (check for assistant message with tool_use content)
        if (event.type === 'assistant' && (event as any).message?.content) {
          const toolUses = (event as any).message.content.filter((c: any) => c.type === 'tool_use')
          if (toolUses.length > 0) {
            this.updateToolsExecuted(toolUses.length)
          }
        }

        // Track turn count from result events
        if (event.type === 'result') {
          const numTurns = (event as any).num_turns
          if (numTurns) {
            this.updateTurns(numTurns)
          }

          // Log raw result events for debugging
          logger.info('📊 Raw result event', {
            subtype: (event as any).subtype,
            is_error: (event as any).is_error,
            num_turns: numTurns,
            result: (event as any).result ?
              (typeof (event as any).result === 'string'
                ? (event as any).result.substring(0, 200)
                : JSON.stringify((event as any).result).substring(0, 200))
              : 'N/A'
          })
        }

        // Format the event using EventFormatter
        const formattedEvent = EventFormatter.format(event)

        // Yield formatted event if valid
        if (formattedEvent) {
          logger.debug('📤 ClaudeSDKAgent yielding event', {
            type: formattedEvent.type
          })
          yield formattedEvent
        }
      }

      // Complete execution tracking
      this.completeExecution()

      logger.info('✅ ClaudeSDKAgent execution complete', {
        turns: this.metadata.turns,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime
      })

    } catch (error) {
      // Mark execution error
      this.errorExecution(error instanceof Error ? error : new Error(String(error)))

      logger.error('❌ ClaudeSDKAgent execution failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      throw error
    } finally {
      // Clear AbortController reference
      this.abortController = null
    }
  }

  /**
   * Cleanup agent resources
   *
   * Aborts the running SDK query. Does NOT close shared ControllerBridge.
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) {
      logger.debug('⚠️  ClaudeSDKAgent already destroyed')
      return
    }

    this.markDestroyed()

    // Abort the SDK query if it's running
    if (this.abortController) {
      logger.debug('🛑 Aborting SDK query')
      this.abortController.abort()
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // DO NOT close ControllerBridge - it's shared and owned by main server

    logger.debug('🗑️  ClaudeSDKAgent destroyed', {
      totalDuration: this.metadata.totalDuration,
      turns: this.metadata.turns,
      toolsExecuted: this.metadata.toolsExecuted
    })
  }
}