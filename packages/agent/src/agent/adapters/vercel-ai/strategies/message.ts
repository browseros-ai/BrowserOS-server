/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message Conversion Strategy
 * Converts conversation history from Gemini to Vercel format
 */

import type {
  CoreMessage,
  VercelContentPart,
} from '../types.js';
import type { Content, ContentUnion } from '@google/genai';
import {
  isTextPart,
  isFunctionCallPart,
  isFunctionResponsePart,
} from '../utils/type-guards.js';

export class MessageConversionStrategy {
  /**
   * Convert Gemini conversation history to Vercel messages
   *
   * @param contents - Array of Gemini Content objects
   * @returns Array of Vercel CoreMessage objects
   */
  geminiToVercel(contents: readonly Content[]): CoreMessage[] {
    const messages: CoreMessage[] = [];

    console.log(`\n[MessageConversion] === Converting ${contents.length} Gemini content(s) to Vercel messages ===`);

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      // Map Gemini roles to Vercel roles
      const role = content.role === 'model' ? 'assistant' : 'user';

      console.log(`\n[MessageConversion] Content #${i + 1}: role='${content.role}' → '${role}'`);

      // Separate parts by type
      const textParts: string[] = [];
      const functionCalls: Array<{
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }> = [];
      const functionResponses: Array<{
        id?: string;
        name?: string;
        response?: Record<string, unknown>;
      }> = [];

      for (const part of content.parts || []) {
        if (isTextPart(part)) {
          textParts.push(part.text);
        } else if (isFunctionCallPart(part)) {
          functionCalls.push(part.functionCall);
          console.log(`  ├─ Found functionCall: ${part.functionCall.name}, id=${part.functionCall.id}`);
        } else if (isFunctionResponsePart(part)) {
          functionResponses.push(part.functionResponse);
          console.log(`  ├─ Found functionResponse: ${part.functionResponse.name}, id=${part.functionResponse.id}`);
        }
        // Skip inlineData, fileData for now (not implemented)
      }

      const textContent = textParts.join('\n');

      console.log(`  ├─ Text parts: ${textParts.length}, functionCalls: ${functionCalls.length}, functionResponses: ${functionResponses.length}`);

      // CASE 1: Simple text message
      if (functionCalls.length === 0 && functionResponses.length === 0) {
        if (textContent) {
          console.log(`  └─ CASE 1: Simple text message`);
          messages.push({
            role: role as 'user' | 'assistant',
            content: textContent,
          });
        }
        continue;
      }

      // CASE 2: Tool results (user providing tool execution results)
      if (functionResponses.length > 0) {
        console.log(`  └─ CASE 2: Tool results (${functionResponses.length} results)`);
        const toolResultParts: VercelContentPart[] = functionResponses.map(
          (fr) => {
            // Pass the Gemini response directly to Vercel AI SDK
            // The response can contain "output" or "error" keys per Gemini spec
            return {
              type: 'tool-result' as const,
              toolCallId: fr.id || this.generateToolCallId(),
              toolName: fr.name || 'unknown',
              result: fr.response || {}, // Direct value, not wrapped
            };
          },
        );

        messages.push({
          role: 'tool',
          content: toolResultParts,
        } as unknown as CoreMessage);
        continue;
      }

      // CASE 3: Assistant with tool calls
      if (role === 'assistant' && functionCalls.length > 0) {
        console.log(`  └─ CASE 3: Assistant with ${functionCalls.length} tool calls`);
        const contentParts: VercelContentPart[] = [];

        // Add text if present
        if (textContent) {
          contentParts.push({
            type: 'text' as const,
            text: textContent,
          });
          console.log(`     ├─ Added text content`);
        }

        // Add tool calls
        // CRITICAL: Use 'args' property (not 'input') - this is what ToolCallPart expects
        for (const fc of functionCalls) {
          const toolCall = {
            type: 'tool-call' as const,
            toolCallId: fc.id || this.generateToolCallId(),
            toolName: fc.name || 'unknown',
            args: fc.args || {}, // Use 'args' - matches ToolCallPart interface
          };
          contentParts.push(toolCall);
          console.log(`     ├─ Added tool-call: ${toolCall.toolName}, id=${toolCall.toolCallId}`);
          console.log(`        └─ args:`, JSON.stringify(toolCall.args));
        }

        const assistantMessage = {
          role: 'assistant',
          content: contentParts,
        } as CoreMessage;

        messages.push(assistantMessage);
        console.log(`     └─ Created assistant message with ${contentParts.length} parts`);
        continue;
      }
    }

    console.log(`\n[MessageConversion] === Conversion complete: ${messages.length} Vercel messages ===\n`);
    return messages;
  }

  /**
   * Convert system instruction to plain text
   *
   * @param instruction - Gemini system instruction (string, Content, or Part)
   * @returns Plain text string or undefined
   */
  convertSystemInstruction(
    instruction: ContentUnion | undefined,
  ): string | undefined {
    if (!instruction) {
      return undefined;
    }

    // Handle string input
    if (typeof instruction === 'string') {
      return instruction;
    }

    // Handle Content object with parts
    if (typeof instruction === 'object' && 'parts' in instruction) {
      const textParts = (instruction.parts || [])
        .filter(isTextPart)
        .map((p) => p.text);

      return textParts.length > 0 ? textParts.join('\n') : undefined;
    }

    return undefined;
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
