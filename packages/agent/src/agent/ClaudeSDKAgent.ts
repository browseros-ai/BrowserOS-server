/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { EventFormatter, FormattedEvent } from '../utils/EventFormatter.js'
import { Logger } from '../utils/Logger.js'
import type { AgentConfig } from './types.js'
import { BaseAgent } from './BaseAgent.js'
import { CLAUDE_SDK_SYSTEM_PROMPT } from './ClaudeSDKAgent.prompt.js'
import * as controllerTools from '@browseros/tools/controller-definitions'
import type { ToolDefinition } from '@browseros/tools'
import { ControllerBridge, ControllerContext } from '@browseros/controller-server'
import { createControllerMcpServer } from './ControllerToolsAdapter.js'

/**
 * Get all controller tools from the controller-definitions module
 */
function getAllControllerTools(): ToolDefinition<any, any, any>[] {
  const tools: ToolDefinition<any, any, any>[] = []

  for (const value of Object.values(controllerTools)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'handler' in value
    ) {
      tools.push(value as ToolDefinition<any, any, any>)
    }
  }

  return tools
}

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
 * - Shared WebSocketManager for browseros-controller connection
 * - Event formatting via EventFormatter
 * - AbortController for cleanup
 * - Metadata tracking
 *
 * Note: Requires external WebSocketManager (provided by main server)
 */
export class ClaudeSDKAgent extends BaseAgent {
  private abortController: AbortController | null = null

  constructor(config: AgentConfig, wsManager: ControllerBridge) {
    Logger.info('🔧 Using shared WebSocketManager for controller connection')

    const controllerContext = new ControllerContext(wsManager)

    // Get all controller tools and create SDK MCP server
    const tools = getAllControllerTools()
    const sdkMcpServer = createControllerMcpServer(tools, controllerContext)

    Logger.info(`✅ Created SDK MCP server with ${tools.length} controller tools`)

    // Pass Claude SDK specific defaults to BaseAgent (must call super before accessing this)
    super('claude-sdk', config, {
      systemPrompt: CLAUDE_SDK_SYSTEM_PROMPT,
      mcpServers: { 'browseros-controller': sdkMcpServer },
      maxTurns: CLAUDE_SDK_DEFAULTS.maxTurns,
      maxThinkingTokens: CLAUDE_SDK_DEFAULTS.maxThinkingTokens,
      permissionMode: CLAUDE_SDK_DEFAULTS.permissionMode
    })

    Logger.info('✅ ClaudeSDKAgent initialized with shared WebSocketManager')
  }

  /**
   * Execute a task using Claude SDK and stream formatted events
   *
   * @param message - User's natural language request
   * @yields FormattedEvent instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    // Start execution tracking
    this.startExecution()
    this.abortController = new AbortController()

    Logger.info('🤖 ClaudeSDKAgent executing', { message: message.substring(0, 100) })

    try {
      // Build SDK options with AbortController
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

      // Call Claude SDK
      const iterator = query({ prompt: message, options })[Symbol.asyncIterator]()

      // Stream events
      while (true) {
        const result = await iterator.next()
        if (result.done) break

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
          Logger.info('📊 Raw result event', {
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
          Logger.debug('📤 ClaudeSDKAgent yielding event', {
            type: formattedEvent.type
          })
          yield formattedEvent
        }
      }

      // Complete execution tracking
      this.completeExecution()

      Logger.info('✅ ClaudeSDKAgent execution complete', {
        turns: this.metadata.turns,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime
      })

    } catch (error) {
      // Mark execution error
      this.errorExecution(error instanceof Error ? error : new Error(String(error)))

      Logger.error('❌ ClaudeSDKAgent execution failed', {
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
   * Aborts the running SDK query. Does NOT close shared WebSocketManager.
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) {
      Logger.debug('⚠️  ClaudeSDKAgent already destroyed')
      return
    }

    this.markDestroyed()

    // Abort the SDK query if it's running
    if (this.abortController) {
      Logger.debug('🛑 Aborting SDK query')
      this.abortController.abort()
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // DO NOT close WebSocketManager - it's shared and owned by main server

    Logger.debug('🗑️  ClaudeSDKAgent destroyed', {
      totalDuration: this.metadata.totalDuration,
      turns: this.metadata.turns,
      toolsExecuted: this.metadata.toolsExecuted
    })
  }
}