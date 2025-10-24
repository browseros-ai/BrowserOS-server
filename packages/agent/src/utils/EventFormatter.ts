/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Formatted event structure for WebSocket clients
 */
export class FormattedEvent {
  type: 'init' | 'thinking' | 'tool_use' | 'tool_result' | 'response' | 'completion' | 'error' | 'processing'
  content: string
  metadata?: {
    turnCount?: number
    isError?: boolean
    duration?: number
    deniedTools?: number
  }

  constructor(type: FormattedEvent['type'], content: string, metadata?: FormattedEvent['metadata']) {
    this.type = type
    this.content = content
    this.metadata = metadata
  }

  toJSON() {
    return {
      type: this.type,
      content: this.content,
      ...(this.metadata && { metadata: this.metadata })
    }
  }
}

/**
 * Formats Claude SDK events into clean, human-readable messages
 */
export class EventFormatter {

  /**
   * Create a processing/heartbeat event to indicate Claude is still working
   */
  static createProcessingEvent(): FormattedEvent {
    return new FormattedEvent('processing', '⏳ Processing...')
  }

  /**
   * Format any Claude SDK event into a FormattedEvent
   */
  static format(event: any): FormattedEvent | null {
    const eventType = event.type
    const subtype = (event as any).subtype

    // SYSTEM EVENTS
    if (eventType === 'system') {
      if (subtype === 'init') {
        return this.formatInit(event)
      }
      if (subtype === 'mcp_server_notification') {
        return this.formatMcpNotification(event)
      }
      return new FormattedEvent('init', 'System initialized')
    }

    // ASSISTANT EVENTS
    if (eventType === 'assistant') {
      return this.formatAssistant(event)
    }

    // USER EVENTS (Tool Results)
    if (eventType === 'user') {
      return this.formatToolResults(event)
    }

    // RESULT EVENTS
    if (eventType === 'result') {
      return this.formatResult(event)
    }

    return null
  }

  /**
   * Format system initialization event
   */
  private static formatInit(event: any): FormattedEvent {
    const mcpServers = event.mcp_servers || []
    const toolCount = event.tools?.length || 0

    if (mcpServers.length > 0) {
      const serverNames = mcpServers.map((s: any) => s.name).join(', ')
      return new FormattedEvent(
        'init',
        `Initializing agent with ${toolCount} tools and MCP servers: ${serverNames}`
      )
    }

    return new FormattedEvent('init', `Initializing agent with ${toolCount} tools`)
  }

  /**
   * Format MCP server notifications
   */
  private static formatMcpNotification(event: any): FormattedEvent {
    return new FormattedEvent('init', `MCP notification: ${JSON.stringify(event.params)}`)
  }

  /**
   * Format assistant messages (text, tool calls, thinking)
   */
  private static formatAssistant(event: any): FormattedEvent | null {
    const message = event.message
    if (!message?.content || !Array.isArray(message.content)) {
      return null
    }

    // Check for tool uses
    const toolUses = message.content.filter((c: any) => c.type === 'tool_use')
    if (toolUses.length > 0) {
      return this.formatToolUse(toolUses)
    }

    // Check for text content
    const textContent = message.content.find((c: any) => c.type === 'text')
    if (textContent) {
      return new FormattedEvent('response', textContent.text)
    }

    // Check for images
    const imageContent = message.content.find((c: any) => c.type === 'image')
    if (imageContent) {
      return new FormattedEvent('response', '[Image generated]')
    }

    return null
  }

  /**
   * Format tool use (assistant calling a tool)
   */
  private static formatToolUse(toolUses: any[]): FormattedEvent {
    if (toolUses.length === 1) {
      const tool = toolUses[0]
      const toolName = this.cleanToolName(tool.name)
      const args = this.formatToolArgs(tool.input)

      return new FormattedEvent('tool_use', `🔧 ${toolName}${args ? `\n   Args: ${args}` : ''}`)
    }

    // Multiple tools
    const toolList = toolUses.map((tool: any) => {
      const toolName = this.cleanToolName(tool.name)
      const args = this.formatToolArgs(tool.input)
      return `   • ${toolName}${args ? ` (${args})` : ''}`
    }).join('\n')

    return new FormattedEvent('tool_use', `🔧 Calling ${toolUses.length} tools:\n${toolList}`)
  }

  /**
   * Format tool results (user role messages with tool_result)
   */
  private static formatToolResults(event: any): FormattedEvent | null {
    const message = event.message
    if (!message?.content || !Array.isArray(message.content)) {
      return null
    }

    const toolResults = message.content.filter((c: any) => c.type === 'tool_result')
    if (toolResults.length === 0) {
      return null
    }

    const results: string[] = []

    for (const result of toolResults) {
      // Handle errors
      if (result.is_error) {
        const errorText = this.extractTextFromContent(result.content)
        results.push(`❌ Error: ${errorText}`)
        continue
      }

      // Extract text only (exclude images)
      const textContent = this.extractTextFromContent(result.content)
      if (textContent) {
        // Truncate long results
        const truncated = textContent.length > 200
          ? textContent.substring(0, 200) + '...'
          : textContent
        results.push(`✓ ${truncated}`)
      } else {
        // Check if there's an image
        const hasImage = this.hasImageContent(result.content)
        if (hasImage) {
          results.push('✓ [Image result]')
        } else {
          results.push('✓ Success')
        }
      }
    }

    if (results.length === 1) {
      return new FormattedEvent('tool_result', results[0] || 'No result')
    }

    return new FormattedEvent('tool_result', `Results:\n${results.map(r => `   ${r}`).join('\n')}`)
  }

  /**
   * Format result event
   * Handles all SDK result scenarios: success, error_max_turns, error_during_execution
   */
  private static formatResult(event: any): FormattedEvent {
    // Step 1: Extract all fields with defensive fallbacks
    const subtype = event.subtype ?? 'unknown'
    const isError = event.is_error ?? false
    const numTurns = event.num_turns ?? 0
    const result = event.result ?? ''
    const duration = event.duration_ms ?? 0
    const denials = event.permission_denials ?? []

    // Step 2: Build metadata
    const metadata = {
      turnCount: numTurns,
      isError: isError,
      duration: duration,
      deniedTools: denials.length
    }

    // Step 3: Handle error subtypes first (most specific)
    if (subtype === 'error_max_turns') {
      return new FormattedEvent(
        'error',
        `⚠️ Max turns hit (${numTurns} turn${numTurns !== 1 ? 's' : ''}) - task incomplete`,
        metadata
      )
    }

    if (subtype === 'error_during_execution') {
      return new FormattedEvent(
        'error',
        `❌ Execution error after ${numTurns} turn${numTurns !== 1 ? 's' : ''}`,
        metadata
      )
    }

    // Step 4: Handle success subtype (check is_error!)
    if (subtype === 'success') {
      if (isError) {
        // Agent gave up - task failed
        const message = result || 'Task failed - no details provided'
        let errorMsg = `❌ Task failed after ${numTurns} turn${numTurns !== 1 ? 's' : ''}: ${message}`

        // Add permission denials if any
        if (denials.length > 0) {
          const toolNames = denials.map((d: any) => this.cleanToolName(d.tool)).join(', ')
          errorMsg += `\n🚫 ${denials.length} tool${denials.length !== 1 ? 's' : ''} blocked: ${toolNames}`
        }

        return new FormattedEvent('error', errorMsg, metadata)
      } else {
        // Real success
        let successMsg = result

        // Add duration warning if slow (> 60 seconds)
        if (duration > 60000) {
          const seconds = Math.round(duration / 1000)
          successMsg += ` (took ${seconds}s)`
        }

        // Add permission denials as warning if any
        if (denials.length > 0) {
          const toolNames = denials.map((d: any) => this.cleanToolName(d.tool)).join(', ')
          successMsg += `\n⚠️ Warning: ${denials.length} tool${denials.length !== 1 ? 's' : ''} blocked: ${toolNames}`
        }

        return new FormattedEvent('completion', successMsg, metadata)
      }
    }

    // Step 5: Fallback for unknown subtypes
    console.warn('[EventFormatter] Unknown result subtype:', subtype, event)

    return new FormattedEvent(
      isError ? 'error' : 'completion',
      `Task ended after ${numTurns} turn${numTurns !== 1 ? 's' : ''} (unknown status: ${subtype})`,
      metadata
    )
  }

  /**
   * Clean up tool names (remove mcp__ prefix, format nicely)
   */
  private static cleanToolName(name: string): string {
    // Remove mcp__servername__ prefix
    let cleaned = name.replace(/^mcp__[^_]+__/, '')

    // Convert snake_case to Title Case
    cleaned = cleaned
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    return cleaned
  }

  /**
   * Format tool arguments into readable string
   */
  private static formatToolArgs(input: any): string {
    if (!input || typeof input !== 'object') {
      return ''
    }

    const keys = Object.keys(input)
    if (keys.length === 0) {
      return ''
    }

    // If single URL argument, just show the URL
    if (keys.length === 1 && keys[0] === 'url') {
      return input.url
    }

    // If single function/script, show truncated version
    if (keys.length === 1 && (keys[0] === 'function' || keys[0] === 'script')) {
      const code = input[keys[0]]
      if (typeof code === 'string') {
        return code.length > 50 ? code.substring(0, 50) + '...' : code
      }
    }

    // For multiple args, show key-value pairs
    const argPairs = keys.map(key => {
      const value = input[key]
      if (typeof value === 'string') {
        return `${key}="${value.length > 30 ? value.substring(0, 30) + '...' : value}"`
      }
      return `${key}=${JSON.stringify(value)}`
    })

    return argPairs.join(', ')
  }

  /**
   * Extract text content from tool result content
   */
  private static extractTextFromContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      const textBlocks = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
      return textBlocks.join('\n')
    }

    return ''
  }

  /**
   * Check if content contains images
   */
  private static hasImageContent(content: any): boolean {
    if (Array.isArray(content)) {
      return content.some((c: any) => c.type === 'image')
    }
    return false
  }

  /**
   * Format Codex SDK events into FormattedEvent
   *
   * Codex event structure (flat, not nested like Claude):
   * - thread.started: Thread initialization
   * - turn.started: Turn begins
   * - item.completed: Response item (agent_message, tool_use, tool_result)
   * - turn.completed: Turn ends with usage stats
   */
  static formatCodex(event: any): FormattedEvent | null {
    const eventType = event.type

    // Thread initialization
    if (eventType === 'thread.started') {
      return new FormattedEvent('init', `🚀 Thread started: ${event.thread_id}`)
    }

    // Turn started - agent is thinking
    if (eventType === 'turn.started') {
      return new FormattedEvent('thinking', '💭 Agent processing...')
    }

    // Item completed - main content events
    if (eventType === 'item.completed') {
      return this.formatCodexItem(event.item)
    }

    // Turn completed - completion with usage stats
    if (eventType === 'turn.completed') {
      return this.formatCodexTurnCompleted(event)
    }

    // Turn failed - error event
    if (eventType === 'turn.failed') {
      const errorMsg = event.error?.message || 'Unknown error'
      return new FormattedEvent('error', `❌ Turn failed: ${errorMsg}`)
    }

    return null
  }

  /**
   * Format Codex item.completed event based on item type
   */
  private static formatCodexItem(item: any): FormattedEvent | null {
    if (!item || !item.type) {
      return null
    }

    // Agent message - final response text
    if (item.type === 'agent_message') {
      return new FormattedEvent('response', item.text || '')
    }

    // Reasoning - Codex thinking/reasoning
    if (item.type === 'reasoning') {
      const text = item.text || item.content || ''
      if (!text) return null

      const truncated = text.length > 150 ? text.substring(0, 150) + '...' : text
      return new FormattedEvent('thinking', `💭 ${truncated}`)
    }

    // MCP tool call - Codex MCP tool usage
    if (item.type === 'mcp_tool_call') {
      // Codex uses item.tool for tool name (not item.name)
      const toolName = this.cleanToolName(item.tool || 'tool')

      // Show tool call with server name
      const serverInfo = item.server ? ` (${item.server})` : ''
      return new FormattedEvent('tool_use', `🔧 ${toolName}${serverInfo}`)
    }

    // Tool use - agent calling a tool (standard format)
    if (item.type === 'tool_use') {
      const toolName = this.cleanToolName(item.name)
      const args = this.formatToolArgs(item.input)
      return new FormattedEvent('tool_use', `🔧 ${toolName}${args ? `\n   Args: ${args}` : ''}`)
    }

    // Tool result - tool execution result (standard format)
    if (item.type === 'tool_result') {
      if (item.error) {
        return new FormattedEvent('tool_result', `❌ Error: ${item.error}`)
      }

      const resultText = typeof item.content === 'string'
        ? item.content
        : JSON.stringify(item.content)

      const truncated = resultText.length > 200
        ? resultText.substring(0, 200) + '...'
        : resultText

      return new FormattedEvent('tool_result', `✓ ${truncated}`)
    }

    return null
  }

  /**
   * Format Codex turn.completed event
   */
  private static formatCodexTurnCompleted(event: any): FormattedEvent {
    const usage = event.usage || {}
    const metadata = {
      turnCount: 1, // Each turn.completed represents one turn
      isError: false,
      duration: 0 // Codex doesn't provide duration in turn.completed
    }

    // Build completion message with usage stats
    let message = '✅ Turn completed'

    if (usage.output_tokens) {
      message += ` (${usage.output_tokens} tokens)`
    }

    return new FormattedEvent('completion', message, metadata)
  }
}
