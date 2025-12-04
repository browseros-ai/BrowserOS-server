/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Response Conversion Strategy
 * Converts LLM responses from Vercel to Gemini format
 * Handles both streaming and non-streaming responses
 */

import { GenerateContentResponse, FinishReason, Part, FunctionCall } from '@google/genai'
import type {
  VercelFinishReason,
  VercelUsage,
  HonoSSEStream,
} from '../types.js';
import {
  VercelGenerateTextResultSchema,
  VercelStreamChunkSchema,
} from '../types.js';
import type { ToolConversionStrategy } from './tool.js';
import { UIMessageStreamWriter } from '../ui-message-stream.js';

export class ResponseConversionStrategy {
  constructor(private toolStrategy: ToolConversionStrategy) {}

  /**
   * Convert Vercel generateText result to Gemini format
   *
   * @param result - Result from Vercel AI generateText()
   * @returns Gemini GenerateContentResponse
   */
  vercelToGemini(result: unknown): GenerateContentResponse {
    // Validate with Zod
    const parsed = VercelGenerateTextResultSchema.safeParse(result);

    if (!parsed.success) {
      // Return minimal valid response
      return this.createEmptyResponse();
    }

    const validated = parsed.data;

    const parts: Part[] = [];
    let functionCalls: FunctionCall[] | undefined;

    // Add text content if present
    if (validated.text) {
      parts.push({ text: validated.text });
    }

    // Convert tool calls using ToolStrategy
    if (validated.toolCalls && validated.toolCalls.length > 0) {
      functionCalls = this.toolStrategy.vercelToGemini(validated.toolCalls);

      // Add to parts (dual representation for Gemini)
      for (const fc of functionCalls) {
        parts.push({ functionCall: fc });
      }
    }

    // Handle usage metadata
    const usageMetadata = this.convertUsage(validated.usage);

    // Create response - testing without Object.setPrototypeOf
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: this.mapFinishReason(validated.finishReason),
          index: 0,
        },
      ],
      // CRITICAL: Top-level functionCalls for turn.ts compatibility
      ...(functionCalls && functionCalls.length > 0 ? { functionCalls } : {}),
      usageMetadata,
    } as GenerateContentResponse;
  }

  /**
   * Convert Vercel stream to Gemini async generator
   * DUAL OUTPUT: Emits UI Message Stream to Hono SSE + converts to Gemini format
   *
   * @param stream - AsyncIterable of Vercel stream chunks
   * @param getUsage - Function to get usage metadata after stream completes
   * @param honoStream - Optional Hono SSE stream for direct frontend streaming
   * @returns AsyncGenerator yielding Gemini responses
   */
  async *streamToGemini(
    stream: AsyncIterable<unknown>,
    getUsage: () => Promise<VercelUsage | undefined>,
    honoStream?: HonoSSEStream,
  ): AsyncGenerator<GenerateContentResponse> {
    let textAccumulator = '';
    const toolCallsMap = new Map<
      string,
      {
        toolCallId: string;
        toolName: string;
        input: unknown;
      }
    >();

    let finishReason: VercelFinishReason | undefined;

    const uiStream = honoStream
      ? new UIMessageStreamWriter(async (data) => {
          try {
            await honoStream.write(data);
          } catch {
            // Failed to write to stream
          }
        })
      : null;

    // Process stream chunks
    for await (const rawChunk of stream) {
      const chunkType = (rawChunk as { type?: string }).type;

      // Handle error chunks first
      if (chunkType === 'error') {
        const errorChunk = rawChunk as any;
        const errorMessage = errorChunk.error?.message || errorChunk.error || 'Unknown error from LLM provider';
        if (uiStream) {
          await uiStream.writeError(errorMessage);
          await uiStream.finish('error');
        }
        throw new Error(`LLM Provider Error: ${errorMessage}`);
      }

      // Try to parse as known chunk type
      const parsed = VercelStreamChunkSchema.safeParse(rawChunk);

      if (!parsed.success) {
        // Skip unknown chunk types (SDK emits many we don't process)
        continue;
      }

      const chunk = parsed.data;

      if (chunk.type === 'text-delta') {
        const delta = chunk.text;
        textAccumulator += delta;

        // Emit UI Message Stream format
        if (uiStream) {
          await uiStream.writeTextDelta(delta);
        }

        yield {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: delta }],
              },
              index: 0,
            },
          ],
        } as GenerateContentResponse;
      } else if (chunk.type === 'tool-call') {
        // Emit UI Message Stream format for tool calls
        if (uiStream) {
          await uiStream.writeToolCall(chunk.toolCallId, chunk.toolName, chunk.input);
        }

        toolCallsMap.set(chunk.toolCallId, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input,
        });
      } else if (chunk.type === 'finish') {
        finishReason = chunk.finishReason;
      }
    }

    // Get usage metadata after stream completes
    let usage: VercelUsage | undefined;
    try {
      usage = await getUsage();
    } catch {
      // Fallback estimation
      usage = this.estimateUsage(textAccumulator);
    }

    // Emit finish events to UI Message Stream
    if (uiStream) {
      const mappedFinishReason = this.mapToDataStreamFinishReason(finishReason);
      await uiStream.finish(mappedFinishReason);
    }

    // Yield final response with tool calls and metadata
    if (toolCallsMap.size > 0 || finishReason || usage) {
      const parts: Part[] = [];
      let functionCalls: FunctionCall[] | undefined;

      if (toolCallsMap.size > 0) {
        // Convert tool calls using ToolStrategy
        const toolCallsArray = Array.from(toolCallsMap.values());
        functionCalls = this.toolStrategy.vercelToGemini(toolCallsArray);

        // Add to parts
        for (const fc of functionCalls) {
          parts.push({ functionCall: fc });
        }
      }

      const usageMetadata = this.convertUsage(usage);

      yield {
        candidates: [
          {
            content: {
              role: 'model',
              parts: parts.length > 0 ? parts : [{ text: '' }],
            },
            finishReason: this.mapFinishReason(finishReason),
            index: 0,
          },
        ],
        // Top-level functionCalls
        ...(functionCalls && functionCalls.length > 0
          ? { functionCalls }
          : {}),
        usageMetadata,
      } as GenerateContentResponse;
    }
  }

  /**
   * Convert usage metadata with fallback for undefined fields
   */
  private convertUsage(usage: VercelUsage | undefined):
    | {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      }
    | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      promptTokenCount: usage.promptTokens ?? 0,
      candidatesTokenCount: usage.completionTokens ?? 0,
      totalTokenCount: usage.totalTokens ?? 0,
    };
  }

  /**
   * Estimate usage when not provided by model
   */
  private estimateUsage(text: string): VercelUsage {
    const estimatedTokens = Math.ceil(text.length / 4);
    return {
      promptTokens: 0,
      completionTokens: estimatedTokens,
      totalTokens: estimatedTokens,
    };
  }

  /**
   * Map Vercel finish reasons to Gemini finish reasons
   */
  private mapFinishReason(
    reason: VercelFinishReason | undefined,
  ): FinishReason {
    switch (reason) {
      case 'stop':
      case 'tool-calls':
        return FinishReason.STOP;
      case 'length':
      case 'max-tokens':
        return FinishReason.MAX_TOKENS;
      case 'content-filter':
        return FinishReason.SAFETY;
      case 'error':
      case 'other':
      case 'unknown':
        return FinishReason.OTHER;
      default:
        return FinishReason.STOP;
    }
  }

  /**
   * Map Vercel finish reasons to data stream protocol finish reasons
   * LanguageModelV1FinishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown'
   * Mostly passthrough except 'max-tokens' → 'length'
   */
  private mapToDataStreamFinishReason(
    reason: VercelFinishReason | undefined,
  ): 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown' {
    if (!reason) return 'stop';
    if (reason === 'max-tokens') return 'length';
    return reason;
  }

  /**
   * Create empty response for error cases
   */
  private createEmptyResponse(): GenerateContentResponse {
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: '' }],
          },
          finishReason: FinishReason.OTHER,
          index: 0,
        },
      ],
    } as GenerateContentResponse;
  }
}
