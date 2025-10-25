/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { FormattedEvent } from '../utils/EventFormatter.js'

/**
 * Claude SDK Event Formatter
 *
 * Handles Claude-specific event structure:
 * - system: Initialization and MCP notifications
 * - assistant: Messages, tool calls, thinking
 * - user: Tool results
 * - result: Final completion/error events
 */
export class ClaudeEventFormatter {
  /**
   * Format Claude SDK event into common FormattedEvent
   *
   * @param event - Raw Claude event
   * @returns FormattedEvent or null if event should not be displayed
   */
  static format(event: any): FormattedEvent | null {
    const eventType = event.type
    const subtype = (event as any).subtype

    if (eventType === 'system') {
      if (subtype === 'init') {
        return this.formatInit(event)
      }
      if (subtype === 'mcp_server_notification') {
        return this.formatMcpNotification(event)
      }
      return new FormattedEvent('init', 'System initialized')
    }

    if (eventType === 'assistant') {
      return this.formatAssistant(event)
    }

    if (eventType === 'user') {
      return this.formatToolResults(event)
    }

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

    const toolUses = message.content.filter((c: any) => c.type === 'tool_use')
    if (toolUses.length > 0) {
      return this.formatToolUse(toolUses)
    }

    const textContent = message.content.find((c: any) => c.type === 'text')
    if (textContent) {
      return new FormattedEvent('response', textContent.text)
    }

    const thinkingContent = message.content.find((c: any) => c.type === 'thinking')
    if (thinkingContent) {
      const text = thinkingContent.thinking || ''
      const truncated = text.length > 100 ? text.substring(0, 100) + '...' : text
      return new FormattedEvent('thinking', `💭 ${truncated}`)
    }

    return null
  }

  /**
   * Format tool use events
   */
  private static formatToolUse(toolUses: any[]): FormattedEvent {
    if (toolUses.length === 1) {
      const tool = toolUses[0]
      const toolName = this.cleanToolName(tool.name)
      const args = this.formatToolArgs(tool.input)
      const argsText = args ? `\n   Args: ${args}` : ''
      return new FormattedEvent('tool_use', `🔧 ${toolName}${argsText}`)
    }

    const toolNames = toolUses
      .map((t: any) => this.cleanToolName(t.name))
      .join(', ')
    return new FormattedEvent('tool_use', `🔧 ${toolNames}`)
  }

  /**
   * Format tool result events
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

    for (const result of toolResults) {
      if (result.is_error || result.error) {
        const errorMsg = result.error || result.content?.[0]?.text || 'Unknown error'
        return new FormattedEvent('tool_result', `❌ Error: ${errorMsg}`)
      }
    }

    const resultTexts = toolResults
      .map((r: any) => this.extractTextFromContent(r.content))
      .filter((t: string) => t.length > 0)

    if (resultTexts.length === 0) {
      return new FormattedEvent('tool_result', '✓ Tool executed')
    }

    const combinedText = resultTexts.join('\n')
    const truncated = combinedText.length > 200
      ? combinedText.substring(0, 200) + '...'
      : combinedText

    const hasImages = toolResults.some((r: any) => this.hasImageContent(r.content))
    const imageIndicator = hasImages ? ' 📷' : ''

    return new FormattedEvent('tool_result', `✓ ${truncated}${imageIndicator}`)
  }

  /**
   * Format result events (completion/error)
   */
  private static formatResult(event: any): FormattedEvent {
    const subtype = event.subtype
    const metadata = {
      turnCount: event.turn_count || 0,
      isError: subtype === 'error',
      duration: event.duration_ms || 0
    }

    if (subtype === 'completion') {
      const usageInfo = event.usage
        ? ` (${event.usage.input_tokens}/${event.usage.output_tokens} tokens)`
        : ''
      return new FormattedEvent('completion', `✅ Completed${usageInfo}`, metadata)
    }

    if (subtype === 'error') {
      const errorMsg = event.error?.message || 'Unknown error'
      return new FormattedEvent('error', `❌ Error: ${errorMsg}`, metadata)
    }

    const errorMsg = event.error?.message || event.message || 'Task stopped'
    return new FormattedEvent('completion', `⏹️  ${errorMsg}`, metadata)
  }

  /**
   * Create heartbeat/processing event
   */
  static createProcessingEvent(): FormattedEvent {
    return new FormattedEvent('thinking', '⏳ Processing...')
  }

  /**
   * Clean tool name by removing prefixes
   */
  private static cleanToolName(name: string): string {
    return name
      .replace(/^mcp__[^_]+__/, '')
      .replace(/^browseros-controller__/, '')
      .replace(/_/g, ' ')
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

    if (keys.length === 1 && keys[0] === 'url') {
      return input.url
    }

    if (keys.length === 1 && (keys[0] === 'function' || keys[0] === 'script')) {
      const code = input[keys[0]]
      if (typeof code === 'string') {
        return code.length > 50 ? code.substring(0, 50) + '...' : code
      }
    }

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
}
