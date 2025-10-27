/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {FormattedEvent} from './types.js';

/**
 * Codex SDK Event Formatter
 *
 * Handles Codex-specific event structure:
 * - thread.started: Thread initialization
 * - turn.started: Agent begins processing
 * - item.completed: Content items (messages, reasoning, tool calls)
 * - turn.completed: Turn ends with usage stats
 * - turn.failed: Error events
 */
export class CodexEventFormatter {
  /**
   * Format Codex SDK event into common FormattedEvent
   *
   * @param event - Raw Codex event
   * @returns FormattedEvent or null if event should not be displayed
   */
  static format(event: any): FormattedEvent | null {
    const eventType = event.type;

    if (eventType === 'thread.started') {
      return new FormattedEvent(
        'init',
        `🚀 Thread started: ${event.thread_id}`,
      );
    }

    if (eventType === 'turn.started') {
      return new FormattedEvent('thinking', '💭 Agent processing...');
    }

    if (eventType === 'item.completed') {
      return this.formatItem(event.item);
    }

    // if (eventType === 'turn.completed') { // Deprecating this event as it doesnt provide much useful information
    //   return this.formatTurnCompleted(event)
    // }

    if (eventType === 'turn.failed') {
      const errorMsg = event.error?.message || 'Unknown error';
      return new FormattedEvent('error', `❌ Turn failed: ${errorMsg}`);
    }

    return null;
  }

  /**
   * Format Codex item.completed event based on item type
   */
  private static formatItem(item: any): FormattedEvent | null {
    if (!item?.type) {
      return null;
    }

    switch (item.type) {
      case 'agent_message':
        return new FormattedEvent('completion', item.text || '');

      case 'reasoning': {
        const text = item.text || item.content || '';
        if (!text) return null;
        const truncated =
          text.length > 150 ? text.substring(0, 150) + '...' : text;
        return new FormattedEvent('thinking', `💭 ${truncated}`);
      }

      case 'mcp_tool_call': {
        const toolName = this.cleanToolName(item.tool || 'tool');
        const serverInfo = item.server ? ` (${item.server})` : '';
        return new FormattedEvent('tool_use', `🔧 ${toolName}${serverInfo}`);
      }

      case 'tool_use': {
        const toolName = this.cleanToolName(item.name);
        const args = this.formatToolArgs(item.input);
        const argsText = args ? `\n   Args: ${args}` : '';
        return new FormattedEvent('tool_use', `🔧 ${toolName}${argsText}`);
      }

      case 'tool_result': {
        if (item.error) {
          return new FormattedEvent('tool_result', `❌ Error: ${item.error}`);
        }

        const resultText =
          typeof item.content === 'string'
            ? item.content
            : JSON.stringify(item.content);

        const truncated =
          resultText.length > 200
            ? resultText.substring(0, 200) + '...'
            : resultText;

        return new FormattedEvent('tool_result', `✓ ${truncated}`);
      }

      default:
        return null;
    }
  }

  /**
   * Format Codex turn.completed event with usage statistics
   */
  private static formatTurnCompleted(event: any): FormattedEvent {
    const usage = event.usage || {};
    const metadata = {
      turnCount: 1,
      isError: false,
      duration: 0,
    };

    let message = '✅ Turn completed';
    if (usage.output_tokens) {
      message += ` (${usage.output_tokens} tokens)`;
    }

    return new FormattedEvent('completion', message, metadata);
  }

  /**
   * Create heartbeat/processing event
   */
  static createProcessingEvent(): FormattedEvent {
    return new FormattedEvent('thinking', '⏳ Processing...');
  }

  /**
   * Clean tool name by removing prefixes
   */
  private static cleanToolName(name: string): string {
    return name
      .replace(/^mcp__[^_]+__/, '')
      .replace(/^browseros-controller__/, '')
      .replace(/_/g, ' ');
  }

  /**
   * Format tool arguments into readable string
   */
  private static formatToolArgs(input: any): string {
    if (!input || typeof input !== 'object') {
      return '';
    }

    const keys = Object.keys(input);
    if (keys.length === 0) {
      return '';
    }

    if (keys.length === 1 && keys[0] === 'url') {
      return input.url;
    }

    if (keys.length === 1 && (keys[0] === 'function' || keys[0] === 'script')) {
      const code = input[keys[0]];
      if (typeof code === 'string') {
        return code.length > 50 ? code.substring(0, 50) + '...' : code;
      }
    }

    const argPairs = keys.map(key => {
      const value = input[key];
      if (typeof value === 'string') {
        return `${key}="${value.length > 30 ? value.substring(0, 30) + '...' : value}"`;
      }
      return `${key}=${JSON.stringify(value)}`;
    });

    return argPairs.join(', ');
  }
}
