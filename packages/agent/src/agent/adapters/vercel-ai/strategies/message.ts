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
  LanguageModelV2ToolResultOutput,
} from '../types.js';
import type { Content, ContentUnion } from '@google/genai';
import {
  isTextPart,
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
} from '../utils/type-guards.js';

// Utility to convert base64 string to Uint8Array for image handling
function convertBase64ToUint8Array(base64String: string): Uint8Array {
  const base64Url = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const latin1string = atob(base64Url);
  return Uint8Array.from(latin1string, (byte) => byte.codePointAt(0)!);
}

export class MessageConversionStrategy {
  /**
   * Convert Gemini conversation history to Vercel messages
   *
   * @param contents - Array of Gemini Content objects
   * @returns Array of Vercel CoreMessage objects
   */
  geminiToVercel(contents: readonly Content[]): CoreMessage[] {
    const messages: CoreMessage[] = [];
    const seenToolResultIds = new Set<string>();  // Track seen tool result IDs to prevent duplicates

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
      const imageParts: Array<{
        mimeType: string;
        data: string;
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
        } else if (isInlineDataPart(part)) {
          imageParts.push(part.inlineData);
          console.log(`  ├─ Found inlineData: ${part.inlineData.mimeType}`);
        }
        // Skip fileData for now (not implemented)
      }

      const textContent = textParts.join('\n');

      console.log(`  ├─ Text parts: ${textParts.length}, functionCalls: ${functionCalls.length}, functionResponses: ${functionResponses.length}, images: ${imageParts.length}`);

      // CASE 1: Simple text message (possibly with images)
      if (functionCalls.length === 0 && functionResponses.length === 0) {
        if (imageParts.length > 0) {
          // Multi-part message with text and images
          console.log(`  └─ CASE 1: Multi-part message (text + ${imageParts.length} images)`);

          const contentParts: VercelContentPart[] = [];

          if (textContent) {
            contentParts.push({
              type: 'text',
              text: textContent,
            });
          }

          for (const img of imageParts) {
            contentParts.push({
              type: 'image',
              image: img.data,  // Pass raw base64 string
              mediaType: img.mimeType,
            });
          }

          messages.push({
            role: role as 'user' | 'assistant',
            content: contentParts,
          } as CoreMessage);
        } else if (textContent) {
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
        console.log(`  └─ CASE 2: Tool results (${functionResponses.length} results, ${imageParts.length} images)`);

        // Filter out duplicate tool results based on ID
        const uniqueResponses = functionResponses.filter((fr) => {
          const id = fr.id || '';
          if (seenToolResultIds.has(id)) {
            console.log(`     ⚠️  Skipping duplicate tool result: ${fr.name}, id=${id}`);
            return false;
          }
          seenToolResultIds.add(id);
          return true;
        });

        // If all tool results were duplicates, skip this message entirely
        if (uniqueResponses.length === 0) {
          console.log(`     └─ All tool results were duplicates, skipping message`);
          continue;
        }

        console.log(`     ├─ Unique tool results: ${uniqueResponses.length} / ${functionResponses.length}`);

        // If there are NO images → standard tool message
        if (imageParts.length === 0) {
          const toolResultParts: VercelContentPart[] = uniqueResponses.map(
            (fr) => {
              // Convert Gemini response to AI SDK v5 structured output format
              let output: LanguageModelV2ToolResultOutput;
              const response = fr.response || {};

              // Check for error first
              if (typeof response === 'object' && 'error' in response && response.error) {
                output = {
                  type: typeof response.error === 'string' ? 'error-text' : 'error-json',
                  value: response.error
                };
              } else if (typeof response === 'object' && 'output' in response) {
                // Gemini's explicit output format: {output: value}
                output = {
                  type: typeof response.output === 'string' ? 'text' : 'json',
                  value: response.output
                };
              } else {
                // Whole response is the output
                output = {
                  type: typeof response === 'string' ? 'text' : 'json',
                  value: response
                };
              }

              return {
                type: 'tool-result' as const,
                toolCallId: fr.id || this.generateToolCallId(),
                toolName: fr.name || 'unknown',
                output: output,
              };
            },
          );

          messages.push({
            role: 'tool',
            content: toolResultParts,
          } as unknown as CoreMessage);
          console.log(`     ├─ Created tool message with ${toolResultParts.length} tool results`);
          continue;
        }

        // If there ARE images → create TWO messages:
        // 1. Tool message (satisfies OpenAI requirement that tool_calls must be followed by tool messages)
        // 2. User message with images (tool messages don't support images)
        console.log(`     ├─ Images detected → Creating TOOL message + USER message`);

        // Message 1: Tool message with tool results (no images)
        const toolResultParts: VercelContentPart[] = uniqueResponses.map(
          (fr) => {
            // Convert Gemini response to AI SDK v5 structured output format
            let output: LanguageModelV2ToolResultOutput;
            const response = fr.response || {};

            // Check for error first
            if (typeof response === 'object' && 'error' in response && response.error) {
              output = {
                type: typeof response.error === 'string' ? 'error-text' : 'error-json',
                value: response.error
              };
            } else if (typeof response === 'object' && 'output' in response) {
              // Gemini's explicit output format: {output: value}
              output = {
                type: typeof response.output === 'string' ? 'text' : 'json',
                value: response.output
              };
            } else {
              // Whole response is the output
              output = {
                type: typeof response === 'string' ? 'text' : 'json',
                value: response
              };
            }

            return {
              type: 'tool-result' as const,
              toolCallId: fr.id || this.generateToolCallId(),
              toolName: fr.name || 'unknown',
              output: output,
            };
          },
        );

        messages.push({
          role: 'tool',
          content: toolResultParts,
        } as unknown as CoreMessage);
        console.log(`     ├─ Created tool message with ${toolResultParts.length} tool results`);

        // Message 2: User message with images
        const userContentParts: VercelContentPart[] = [];

        // Add explanatory text
        userContentParts.push({
          type: 'text',
          text: `Here are the screenshots from the tool execution:`,
        });

        // Add images as raw base64 string (will be converted to data URL by OpenAI provider)
        for (const img of imageParts) {
          userContentParts.push({
            type: 'image',
            image: img.data,  // Pass raw base64 string
            mediaType: img.mimeType,
          });
          console.log(`     ├─ Added image: ${img.mimeType}`);
        }

        messages.push({
          role: 'user',
          content: userContentParts,
        } as CoreMessage);
        console.log(`     └─ Created user message with ${userContentParts.length} parts (${imageParts.length} images)`);
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
        // CRITICAL: Use 'input' property - this is what ToolCallPart expects per AI SDK v5
        for (const fc of functionCalls) {
          const toolCall = {
            type: 'tool-call' as const,
            toolCallId: fc.id || this.generateToolCallId(),
            toolName: fc.name || 'unknown',
            input: fc.args || {}, // Use 'input' - matches ToolCallPart interface
          };
          contentParts.push(toolCall);
          console.log(`     ├─ Added tool-call: ${toolCall.toolName}, id=${toolCall.toolCallId}`);
          console.log(`        └─ input:`, JSON.stringify(toolCall.input));
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
