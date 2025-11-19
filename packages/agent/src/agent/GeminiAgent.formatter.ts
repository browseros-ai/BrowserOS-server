/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {FormattedEvent} from './types.js';

/**
 * Gemini CLI Event Formatter
 *
 * Maps GeminiEventType to FormattedEvent:
 * - Content: Accumulate text chunks, emit as 'response'
 * - ToolCallRequest: Emit as 'tool_use'
 * - Thought: Emit as 'thinking'
 * - Finished: Emit as 'completion' with usage metadata
 * - Error: Emit as 'error'
 */
export class GeminiEventFormatter {
  private textBuffer: string = '';

  /**
   * Process a Gemini event and return formatted event(s)
   *
   * @param event - Raw Gemini event from GeminiClient.sendMessageStream()
   * @returns FormattedEvent, array of FormattedEvents, or null
   */
  format(event: any): FormattedEvent | FormattedEvent[] | null {
    const eventType = event.type;

    switch (eventType) {
      case 'content':
        return this.formatContent(event);

      case 'tool_call_request':
        return this.formatToolCallRequest(event);

      case 'thought':
        return this.formatThought(event);

      case 'finished':
        return this.formatFinished(event);

      case 'error':
        return this.formatError(event);

      case 'loop_detected':
        return this.formatLoopDetected(event);

      case 'max_session_turns':
        return this.formatMaxTurns(event);

      case 'chat_compressed':
        return this.formatChatCompressed();

      default:
        return null;
    }
  }

  /**
   * Format Content event - accumulate text chunks (don't emit response events)
   */
  private formatContent(event: any): null {
    this.textBuffer += event.value || '';
    return null;
  }

  /**
   * Format ToolCallRequest event - emit tool_use only
   */
  private formatToolCallRequest(event: any): FormattedEvent {
    // Clear text buffer but don't emit response
    this.textBuffer = '';

    const toolName = event.value?.name || 'unknown';
    const toolArgs = event.value?.args || {};
    const argsStr = JSON.stringify(toolArgs, null, 2);

    return new FormattedEvent('tool_use', `${toolName}\n${argsStr}`);
  }

  /**
   * Format Thought event
   */
  private formatThought(event: any): FormattedEvent {
    const thought = event.value?.text || 'Thinking...';
    return new FormattedEvent('thinking', thought);
  }

  /**
   * Format Finished event - emit accumulated content as thinking event
   */
  private formatFinished(event: any): FormattedEvent | null {
    if (this.textBuffer.trim()) {
      const response = new FormattedEvent('thinking', this.textBuffer);
      this.textBuffer = '';
      return response;
    }
    this.textBuffer = '';
    return null;
  }

  /**
   * Format Error event
   */
  private formatError(event: any): FormattedEvent {
    const error = event.value?.error;
    const message = error?.message || 'Unknown error occurred';
    return new FormattedEvent('error', message, {isError: true});
  }

  /**
   * Format LoopDetected event
   */
  private formatLoopDetected(event: any): FormattedEvent {
    return new FormattedEvent('error', 'Loop detected - terminating execution', {
      isError: true,
    });
  }

  /**
   * Format MaxSessionTurns event - treat as error since conversation didn't complete naturally
   */
  private formatMaxTurns(event: any): FormattedEvent {
    const maxTurns = event.value?.maxTurns || 'unknown';
    return new FormattedEvent(
      'error',
      `Maximum session turns reached (${maxTurns})`,
      {isError: true},
    );
  }

  /**
   * Format ChatCompressed event
   */
  private formatChatCompressed(): FormattedEvent {
    return new FormattedEvent('thinking', 'Chat history compressed');
  }

  /**
   * Create a tool result event (called after executeToolCall)
   */
  static createToolResultEvent(
    toolName: string,
    success: boolean,
    result?: string,
  ): FormattedEvent {
    const content = success
      ? `Tool ${toolName} completed successfully${result ? ': ' + result : ''}`
      : `Tool ${toolName} failed${result ? ': ' + result : ''}`;

    return new FormattedEvent('tool_result', content, {
      isError: !success,
    });
  }

  /**
   * Reset text buffer (useful between turns)
   */
  reset(): void {
    this.textBuffer = '';
  }
}
