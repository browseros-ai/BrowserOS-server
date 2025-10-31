/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type {ThreadEvent} from '@browseros/codex-sdk-ts';
import type {ThreadItem} from '@browseros/codex-sdk-ts';
import {FormattedEvent} from './types.js';

/**
 * Codex SDK Event Formatter
 *
 * Maps Codex events to FormattedEvent types:
 * - thread.started -> init
 * - turn.started -> thinking
 * - item.started/item.completed -> various (thinking, tool_use, tool_result, error)
 * - turn.failed -> error
 * - error -> error
 *
 * Note: turn.completed is handled in CodexSDKAgent.execute() to re-emit final agent_message as completion
 */
export class CodexEventFormatter {
  /**
   * Format Codex SDK event into FormattedEvent
   *
   * @param event - Raw Codex event
   * @returns FormattedEvent or null if event should not be displayed
   */
  static format(event: ThreadEvent): FormattedEvent | null {
    switch (event.type) {
      case 'thread.started':
        // return new FormattedEvent('init', `Thread started: ${event.thread_id}`);
        // No need to show thread started event to user
        return null;

      case 'turn.started':
        return new FormattedEvent('thinking', 'Agent processing...');

      case 'item.started':
      case 'item.completed':
        return this.formatItem(event.item);

      case 'turn.failed':
        return new FormattedEvent(
          'error',
          `Turn failed: ${event.error.message}`,
        );

      case 'error':
        return new FormattedEvent('error', event.message);

      case 'turn.completed':
        return null;

      default:
        return null;
    }
  }

  /**
   * Format Codex item based on type
   */
  private static formatItem(item: ThreadItem): FormattedEvent | null {
    switch (item.type) {
      case 'agent_message':
        return new FormattedEvent('thinking', item.text);

      case 'reasoning': {
        const text = item.text;
        if (!text) return null;
        const truncated =
          text.length > 150 ? text.substring(0, 150) + '...' : text;
        return new FormattedEvent('thinking', truncated);
      }

      case 'mcp_tool_call': {
        const toolName = this.cleanToolName(item.tool);
        const status = item.status;

        if (status === 'in_progress') {
          return new FormattedEvent('tool_use', `Executing ${toolName}`);
        } else if (status === 'completed') {
          return new FormattedEvent('tool_result', `${toolName} completed`);
        } else if (status === 'failed') {
          return new FormattedEvent('tool_result', `${toolName} failed`);
        }

        return null;
      }

      case 'command_execution': {
        const cmd = item.command;
        const truncated = cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd;
        return new FormattedEvent('thinking', `Executing: ${truncated}`);
      }

      case 'file_change': {
        const count = item.changes.length;
        return new FormattedEvent(
          'thinking',
          `Modified ${count} file${count !== 1 ? 's' : ''}`,
        );
      }

      case 'web_search': {
        const query = item.query;
        const truncated =
          query.length > 50 ? query.substring(0, 50) + '...' : query;
        return new FormattedEvent('thinking', `Searching: ${truncated}`);
      }

      case 'todo_list': {
        const todoItems = item.items
          .map(i => `${i.completed ? '- [x]' : '- [ ]'} ${i.text}`)
          .join('\n');
        return new FormattedEvent('thinking', todoItems);
      }

      case 'error':
        return new FormattedEvent('error', item.message);

      default:
        return null;
    }
  }

  /**
   * Create heartbeat/processing event
   */
  static createProcessingEvent(): FormattedEvent {
    return new FormattedEvent('thinking', 'Processing...');
  }

  /**
   * Clean tool name by removing MCP prefixes
   */
  private static cleanToolName(name: string): string {
    return name
      .replace(/^mcp__[^_]+__/, '')
      .replace(/^browseros-controller__/, '')
      .replace(/_/g, ' ');
  }
}
