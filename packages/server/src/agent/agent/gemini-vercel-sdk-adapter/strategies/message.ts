/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message Conversion Strategy
 * Converts conversation history from Gemini to Vercel format
 */

import type {CoreMessage} from 'ai';
import type {
  LanguageModelV2ToolResultOutput,
  JSONValue,
} from '@ai-sdk/provider';
import type {Content, ContentUnion} from '@google/genai';

import type {ProviderAdapter} from '../adapters/index.js';
import type {
  ProviderMetadata,
  FunctionCallWithMetadata,
} from '../adapters/types.js';
import type {VercelContentPart} from '../types.js';
import {
  isTextPart,
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
} from '../utils/type-guards.js';

export class MessageConversionStrategy {
  constructor(private adapter: ProviderAdapter) {}

  /**
   * Convert Gemini conversation history to Vercel messages
   *
   * @param contents - Array of Gemini Content objects
   * @returns Array of Vercel CoreMessage objects
   */
  geminiToVercel(contents: readonly Content[]): CoreMessage[] {
    const messages: CoreMessage[] = [];
    const seenToolResultIds = new Set<string>();

    // First pass: collect all tool call IDs and tool result IDs
    const allToolCallIds = new Set<string>();
    const allToolResultIds = new Set<string>();
    for (const content of contents) {
      for (const part of content.parts || []) {
        if (isFunctionCallPart(part) && part.functionCall?.id) {
          allToolCallIds.add(part.functionCall.id);
        }
        if (isFunctionResponsePart(part) && part.functionResponse?.id) {
          allToolResultIds.add(part.functionResponse.id);
        }
      }
    }

    for (const content of contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';

      // Separate parts by type
      const textParts: string[] = [];
      const functionCalls: FunctionCallWithMetadata[] = [];
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
          // Extract provider metadata from part (attached by ResponseConversionStrategy)
          const partWithMetadata = part as typeof part & {
            providerMetadata?: ProviderMetadata;
          };
          functionCalls.push({
            ...part.functionCall,
            providerMetadata: partWithMetadata.providerMetadata,
          });
        } else if (isFunctionResponsePart(part)) {
          functionResponses.push(part.functionResponse);
        } else if (isInlineDataPart(part)) {
          imageParts.push(part.inlineData);
        }
      }

      const textContent = textParts.join('\n');

      // CASE 1: Simple text message (possibly with images)
      if (functionCalls.length === 0 && functionResponses.length === 0) {
        if (imageParts.length > 0) {
          // Multi-part message with text and images

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
              image: img.data, // Pass raw base64 string
              mediaType: img.mimeType,
            });
          }

          messages.push({
            role: role as 'user' | 'assistant',
            content: contentParts,
          } as CoreMessage);
        } else if (textContent) {
          messages.push({
            role: role as 'user' | 'assistant',
            content: textContent,
          });
        }
        continue;
      }

      // CASE 2: Tool results (user providing tool execution results)
      if (functionResponses.length > 0) {
        // Filter out duplicate tool results AND orphaned tool results (no matching tool_use)
        const uniqueResponses = functionResponses.filter(fr => {
          const id = fr.id || '';
          // Skip duplicates
          if (seenToolResultIds.has(id)) {
            return false;
          }
          // Skip orphaned tool results (no matching tool_use in history)
          // This prevents: "unexpected tool_use_id found in tool_result blocks"
          if (id && !allToolCallIds.has(id)) {
            return false;
          }
          seenToolResultIds.add(id);
          return true;
        });

        // If all tool results were duplicates, skip this message entirely
        if (uniqueResponses.length === 0) {
          continue;
        }

        // If there are NO images → standard tool message
        if (imageParts.length === 0) {
          const toolResultParts =
            this.convertFunctionResponsesToToolResults(uniqueResponses);
          messages.push({
            role: 'tool',
            content: toolResultParts,
          } as unknown as CoreMessage);
          continue;
        }

        // If there ARE images → create TWO messages:
        // 1. Tool message (satisfies OpenAI requirement that tool_calls must be followed by tool messages)
        // 2. User message with images (tool messages don't support images)

        // Message 1: Tool message with tool results (no images)
        const toolResultParts =
          this.convertFunctionResponsesToToolResults(uniqueResponses);
        messages.push({
          role: 'tool',
          content: toolResultParts,
        } as unknown as CoreMessage);

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
            image: img.data,
            mediaType: img.mimeType,
          });
        }

        messages.push({
          role: 'user',
          content: userContentParts,
        } as CoreMessage);
        continue;
      }

      // CASE 3: Assistant with tool calls
      if (role === 'assistant' && functionCalls.length > 0) {
        const contentParts: VercelContentPart[] = [];

        // Add text if present
        if (textContent) {
          contentParts.push({
            type: 'text' as const,
            text: textContent,
          });
        }

        // Add tool calls - but ONLY if they have matching tool results
        // This prevents Anthropic error: "tool_use ids were found without tool_result blocks"
        let isFirst = true;
        for (const fc of functionCalls) {
          const toolCallId = fc.id || this.generateToolCallId();

          // Skip orphaned tool calls (no matching tool result in history)
          if (fc.id && !allToolResultIds.has(fc.id)) {
            continue;
          }

          const toolCallPart: Record<string, unknown> = {
            type: 'tool-call' as const,
            toolCallId,
            toolName: fc.name || 'unknown',
            input: fc.args || {},
          };

          // Let adapter extract provider options from stored metadata
          if (isFirst) {
            const providerOptions = this.adapter.getToolCallProviderOptions(fc);
            if (providerOptions) {
              toolCallPart.providerOptions = providerOptions;
            }
            isFirst = false;
          }

          contentParts.push(toolCallPart as unknown as VercelContentPart);
        }

        // Only add the message if there's content (text or valid tool calls)
        if (contentParts.length > 0) {
          const message = {
            role: 'assistant' as const,
            content: contentParts,
          };

          messages.push(message as CoreMessage);
        }
        continue;
      }
    }

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
        .map(p => p.text);

      return textParts.length > 0 ? textParts.join('\n') : undefined;
    }

    return undefined;
  }

  /**
   * Convert function responses to tool result parts for AI SDK v5
   */
  private convertFunctionResponsesToToolResults(
    responses: Array<{
      id?: string;
      name?: string;
      response?: Record<string, unknown>;
    }>,
  ): VercelContentPart[] {
    return responses.map(fr => {
      // Convert Gemini response to AI SDK v5 structured output format
      let output: LanguageModelV2ToolResultOutput;
      const response = fr.response || {};

      // Check for error first
      if (
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        const errorValue = response.error;
        output =
          typeof errorValue === 'string'
            ? {type: 'error-text', value: errorValue}
            : {type: 'error-json', value: errorValue as JSONValue};
      } else if (typeof response === 'object' && 'output' in response) {
        // Gemini's explicit output format: {output: value}
        const outputValue = response.output;
        output =
          typeof outputValue === 'string'
            ? {type: 'text', value: outputValue}
            : {type: 'json', value: outputValue as JSONValue};
      } else {
        // Whole response is the output
        output =
          typeof response === 'string'
            ? {type: 'text', value: response}
            : {type: 'json', value: response as JSONValue};
      }

      return {
        type: 'tool-result' as const,
        toolCallId: fr.id || this.generateToolCallId(),
        toolName: fr.name || 'unknown',
        output: output,
      };
    });
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
