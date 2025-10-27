/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { accessSync, constants as fsConstants } from 'node:fs'
import { dirname, join } from 'node:path'
import { Codex, type McpServerConfig } from '@browseros/codex-sdk-ts'
import { FormattedEvent, type AgentConfig } from './types.js'
import { CodexEventFormatter } from './CodexSDKAgent.formatter.js'
import { logger, fetchBrowserOSConfig, type BrowserOSConfig, type Provider } from '@browseros/common'
import { BaseAgent } from './BaseAgent.js'
import { AGENT_SYSTEM_PROMPT } from './Agent.prompt.js'
import { allControllerTools } from '@browseros/tools/controller-based'
import type { ControllerBridge } from '@browseros/controller-server'

/**
 * System-level environment configuration
 * Only binary path - everything else comes from AgentConfig
 */
const DEFAULT_CODEX_BINARY_PATH = '/opt/homebrew/bin/codex'

/**
 * Codex SDK specific default configuration
 */
const CODEX_SDK_DEFAULTS = {
  maxTurns: 100,
  mcpServerHost: '127.0.0.1',
  mcpServerPort: 9100
} as const

/**
 * Build MCP server configuration from agent config
 */
function buildMcpServerConfig(config: AgentConfig): McpServerConfig {
  const port = config.mcpServerPort || CODEX_SDK_DEFAULTS.mcpServerPort
  const mcpServerUrl = `http://${CODEX_SDK_DEFAULTS.mcpServerHost}:${port}/mcp`
  return { url: mcpServerUrl } as McpServerConfig
}

/**
 * Codex SDK Agent implementation
 *
 * Wraps @openai/codex-sdk with:
 * - In-process SDK MCP server with controller tools
 * - Shared ControllerBridge for browseros-controller connection
 * - Event formatting via EventFormatter (Codex → FormattedEvent)
 * - Break-loop abort pattern (Codex has no native abort)
 * - Heartbeat mechanism for long-running operations
 * - Thread-based execution model
 * - Metadata tracking
 * - Config fetching from BrowserOS Config URL
 *
 * Environment Variables:
 * - CODEX_BINARY_PATH: Optional override when no bundled codex binary is found (default fallback: /opt/homebrew/bin/codex)
 * - BROWSEROS_CONFIG_URL: URL to fetch provider config (optional)
 * - OPENAI_API_KEY: OpenAI API key fallback (used if config URL not set or fails)
 *
 * Configuration (via AgentConfig):
 * - apiKey: OpenAI API key
 * - mcpServerPort: MCP server port (optional, defaults to 9100)
 * - cwd: Working directory
 */
export class CodexSDKAgent extends BaseAgent {
  private abortController: AbortController | null = null
  private codex: Codex | null = null
  private gatewayConfig: BrowserOSConfig | null = null
  private selectedProvider: Provider | null = null
  private codexExecutablePath: string = DEFAULT_CODEX_BINARY_PATH

  constructor(config: AgentConfig, _controllerBridge: ControllerBridge) {
    const mcpServerConfig = buildMcpServerConfig(config)

    logger.info('🔧 CodexSDKAgent initializing', {
      mcpServerUrl: mcpServerConfig.url,
      defaultCodexBinaryPath: DEFAULT_CODEX_BINARY_PATH,
      toolCount: allControllerTools.length
    })

    super('codex-sdk', config, {
      systemPrompt: AGENT_SYSTEM_PROMPT,
      mcpServers: { 'browseros-controller': mcpServerConfig },
      maxTurns: CODEX_SDK_DEFAULTS.maxTurns
    })

    logger.info('✅ CodexSDKAgent initialized successfully')
  }

  /**
   * Initialize agent - fetch config from BrowserOS Config URL if configured
   * Falls back to OPENAI_API_KEY env var if config URL not set or fails
   */
  override async init(): Promise<void> {
    this.codexExecutablePath = this.resolveCodexExecutablePath()

    logger.info('🚀 Resolved Codex binary path', {
      codexExecutablePath: this.codexExecutablePath
    })

    const configUrl = process.env.BROWSEROS_CONFIG_URL

    if (configUrl) {
      logger.info('🌐 Fetching config from BrowserOS Config URL', { configUrl })

      try {
        this.gatewayConfig = await fetchBrowserOSConfig(configUrl)
        this.selectedProvider = this.gatewayConfig.providers.find(p => p.name === 'openai')

        if (!this.selectedProvider) {
          throw new Error('No openai provider found in config')
        }

        this.config.apiKey = this.selectedProvider.apiKey

        logger.info('✅ Using API key from BrowserOS Config URL', {
          model: this.selectedProvider.model
        })
      } catch (error) {
        logger.warn('⚠️  Failed to fetch from config URL, falling back to OPENAI_API_KEY', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (!this.config.apiKey) {
      const envApiKey = process.env.OPENAI_API_KEY
      if (envApiKey) {
        this.config.apiKey = envApiKey
        logger.info('✅ Using API key from OPENAI_API_KEY env var')
      } else {
        throw new Error(
          'No API key found. Set either BROWSEROS_CONFIG_URL or OPENAI_API_KEY'
        )
      }
    }

    await super.init()

    // Initialize Codex instance with binary path and API key from config
    this.codex = new Codex({
      codexPathOverride: this.codexExecutablePath,
      apiKey: this.config.apiKey
    })

    logger.info('✅ Codex SDK initialized', {
      binaryPath: this.codexExecutablePath,
      model: this.selectedProvider?.model
    })
  }

  private resolveCodexExecutablePath(): string {
    const currentBinaryDirectory = dirname(process.execPath)
    const codexBinaryName = process.platform === 'win32' ? 'codex.exe' : 'codex'
    const bundledCodexPath = join(currentBinaryDirectory, codexBinaryName)

    try {
      accessSync(bundledCodexPath, fsConstants.X_OK)
      return bundledCodexPath
    } catch {
      // Ignore failures; fall back to env/default below
    }

    if (process.env.CODEX_BINARY_PATH) {
      return process.env.CODEX_BINARY_PATH
    }

    return DEFAULT_CODEX_BINARY_PATH
  }

  /**
   * Wrapper around iterator.next() that yields heartbeat events while waiting
   * @param iterator - The async iterator
   * @yields Heartbeat events (FormattedEvent) while waiting, then the final iterator result (IteratorResult)
   */
  private async *nextWithHeartbeat(iterator: AsyncIterator<any>): AsyncGenerator<any> {
    const heartbeatInterval = 20000 // 20 seconds
    let heartbeatTimer: NodeJS.Timeout | null = null
    let abortHandler: (() => void) | null = null

    // Call iterator.next() once - this generator wraps a single next() call
    const iteratorPromise = iterator.next()

    // Create abort promise
    const abortPromise = new Promise<never>((_, reject) => {
      if (this.abortController) {
        abortHandler = () => {
          reject(new Error('Agent execution aborted by client'))
        }
        this.abortController.signal.addEventListener('abort', abortHandler, { once: true })
      }
    })

    try {
      // Loop until the iterator promise resolves, yielding heartbeats while waiting
      while (true) {
        // Check if execution was aborted
        if (this.abortController?.signal.aborted) {
          logger.info('⚠️  Agent execution aborted during heartbeat wait')
          return
        }

        // Create timeout promise for this iteration
        const timeoutPromise = new Promise(resolve => {
          heartbeatTimer = setTimeout(() => resolve({ type: 'heartbeat' }), heartbeatInterval)
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
          // Break loop to stop iteration (Codex has no native abort)
          return
        }

        // Clear the timeout if it was set
        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer)
          heartbeatTimer = null
        }

        if (race.type === 'heartbeat') {
          // Heartbeat timeout occurred - yield processing event and continue waiting
          yield CodexEventFormatter.createProcessingEvent()
          // Loop continues - will race the same iteratorPromise (still pending) vs new timeout
        } else {
          // Iterator result arrived - yield it and exit this generator
          yield race.result
          return
        }
      }
    } finally {
      // Clean up heartbeat timer
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer)
      }

      // Clean up abort listener if it wasn't triggered
      if (abortHandler && this.abortController && !this.abortController.signal.aborted) {
        this.abortController.signal.removeEventListener('abort', abortHandler)
      }
    }
  }

  /**
   * Execute a task using Codex SDK and stream formatted events
   *
   * @param message - User's natural language request
   * @yields FormattedEvent instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    if (!this.initialized) {
      await this.init()
    }

    if (!this.codex) {
      throw new Error('Codex instance not initialized')
    }

    this.startExecution()
    this.abortController = new AbortController()

    logger.info('🤖 CodexSDKAgent executing', { message: message.substring(0, 100) })

    try {
      logger.debug('🔧 MCP Servers configured', {
        count: Object.keys(this.config.mcpServers || {}).length,
        servers: Object.keys(this.config.mcpServers || {})
      })

      // Start thread with MCP servers (pass as Record, not array)
      const thread = this.codex.startThread({
        mcpServers: this.config.mcpServers
      } as any)

      logger.debug('📡 Started Codex thread with MCP servers', {
        mcpServerCount: Object.keys(this.config.mcpServers || {}).length
      })

      // Get streaming events from thread
      // Pass system prompt as first message, then user message
      const messages: Array<{ type: 'text'; text: string }> = []

      // Add system prompt if configured
      if (this.config.systemPrompt) {
        messages.push({ type: 'text' as const, text: this.config.systemPrompt })
      }

      // Add user message
      messages.push({ type: 'text' as const, text: message })

      const { events } = await thread.runStreamed(messages)

      // Create iterator for streaming
      const iterator = events[Symbol.asyncIterator]()

      try {
        // Stream events with heartbeat and abort handling
        while (true) {
          // Check if execution was aborted (break-loop pattern)
          if (this.abortController?.signal.aborted) {
            logger.info('⚠️  Agent execution aborted by client (breaking loop)')
            break
          }

        let result: IteratorResult<any> | null = null

        // Iterate through heartbeat generator to get the actual result
        for await (const item of this.nextWithHeartbeat(iterator)) {
          if (item && item.done !== undefined) {
            // This is the final result
            result = item
          } else {
            // This is a heartbeat/processing event - update time to prevent timeout
            this.updateEventTime()
            yield item
          }
        }

        if (!result || result.done) break

        const event = result.value

        // Log raw Codex event for debugging
        if (event.item && event.item.type === 'mcp_tool_call') {
          // Full item dump for mcp_tool_call to see structure
          logger.info('📥 Codex MCP tool event', {
            type: event.type,
            fullItem: JSON.stringify(event.item, null, 2).substring(0, 500)
          })
        } else if (event.item && event.item.type === 'reasoning') {
          // Show reasoning text (truncated)
          logger.info('📥 Codex reasoning event', {
            type: event.type,
            text: (event.item.text || '').substring(0, 100)
          })
        } else {
          logger.info('📥 Codex event received', {
            type: event.type,
            itemType: event.type === 'item.completed' || event.type === 'item.started' ? event.item?.type : undefined,
            hasItem: !!event.item
          })
        }

        // Update event time
        this.updateEventTime()

        // Track tool executions from item.completed events with tool_use type
        if (event.type === 'item.completed' && event.item?.type === 'tool_use') {
          this.updateToolsExecuted(1)
          logger.debug('🔧 Tool use detected', {
            toolName: event.item.name,
            toolId: event.item.id
          })
        }

        // Track turn count from turn.completed events
        if (event.type === 'turn.completed') {
          this.updateTurns(1)

          // Log usage statistics
          if (event.usage) {
            logger.info('📊 Turn completed', {
              inputTokens: event.usage.input_tokens,
              cachedInputTokens: event.usage.cached_input_tokens,
              outputTokens: event.usage.output_tokens
            })
          }
        }

        // Format the event using CodexEventFormatter
        const formattedEvent = CodexEventFormatter.format(event)

        // Yield formatted event if valid
        if (formattedEvent) {
          logger.info('📤 CodexSDKAgent yielding event', {
            type: formattedEvent.type,
            originalType: event.type
          })
          yield formattedEvent
        }
      }
      } finally {
        // CRITICAL: Close iterator to trigger SIGKILL in forked SDK's finally block
        if (iterator.return) {
          logger.debug('🔒 Closing iterator to terminate Codex subprocess')
          await iterator.return(undefined)
        }
      }

      // Complete execution tracking
      this.completeExecution()

      logger.info('✅ CodexSDKAgent execution complete', {
        turns: this.metadata.turns,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime
      })

    } catch (error) {
      // Mark execution error
      this.errorExecution(error instanceof Error ? error : new Error(String(error)))

      logger.error('❌ CodexSDKAgent execution failed', {
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
   * Immediately kills the Codex subprocess using SIGKILL.
   * Does NOT close shared ControllerBridge.
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) {
      logger.debug('⚠️  CodexSDKAgent already destroyed')
      return
    }

    this.markDestroyed()

    // Trigger abort controller for cleanup
    if (this.abortController) {
      this.abortController.abort()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // DO NOT close ControllerBridge - it's shared and owned by main server

    logger.debug('🗑️  CodexSDKAgent destroyed', {
      totalDuration: this.metadata.totalDuration,
      turns: this.metadata.turns,
      toolsExecuted: this.metadata.toolsExecuted
    })
  }
}
