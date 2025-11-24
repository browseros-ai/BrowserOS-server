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

import { GenerateContentResponse, FinishReason } from '@google/genai';
import type {
  Part,
  FunctionCall,
  VercelFinishReason,
  VercelUsage,
} from '../types.js';
import {
  VercelGenerateTextResultSchema,
  VercelStreamChunkSchema,
} from '../types.js';
import type { ToolConversionStrategy } from './tool.js';

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
      console.warn(
        '[VercelAI] Invalid generateText result:',
        parsed.error.format(),
      );
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

    // Create response with Object.setPrototypeOf pattern
    // This allows setting readonly functionCalls property
    return Object.setPrototypeOf(
      {
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
      },
      GenerateContentResponse.prototype,
    );
  }

  /**
   * Convert Vercel stream to Gemini async generator
   *
   * @param stream - AsyncIterable of Vercel stream chunks
   * @param getUsage - Function to get usage metadata after stream completes
   * @returns AsyncGenerator yielding Gemini responses
   */
  async *streamToGemini(
    stream: AsyncIterable<unknown>,
    getUsage: () => Promise<VercelUsage | undefined>,
  ): AsyncGenerator<GenerateContentResponse> {
    let textAccumulator = '';
    const toolCallsMap = new Map<
      string,
      {
        toolCallId: string;
        toolName: string;
        args: unknown;
      }
    >();

    let finishReason: VercelFinishReason | undefined;
    let chunkCount = 0;

    console.log('\n[VercelAI→Gemini] 🔄 Starting stream transformation...');

    // Process stream chunks
    for await (const rawChunk of stream) {
      chunkCount++;
      const chunkType = (rawChunk as { type?: string }).type;

      // Log every chunk we receive
      console.log(`[VercelAI→Gemini] Chunk #${chunkCount}: type='${chunkType}'`);

      // Handle error chunks first
      if (chunkType === 'error') {
        const errorChunk = rawChunk as any;
        const errorMessage = errorChunk.error?.message || errorChunk.error || 'Unknown error from LLM provider';
        console.error(
          `[VercelAI→Gemini] ❌ Chunk #${chunkCount}: ERROR from provider:`,
          errorMessage
        );
        console.error('Full error chunk:', JSON.stringify(rawChunk, null, 2));
        throw new Error(`LLM Provider Error: ${errorMessage}`);
      }

      // Try to parse as known chunk type
      const parsed = VercelStreamChunkSchema.safeParse(rawChunk);

      if (!parsed.success) {
        // Log validation errors for text-delta to debug
        if (chunkType === 'text-delta') {
          console.log(
            `[VercelAI→Gemini] ❌ Chunk #${chunkCount}: text-delta FAILED validation`,
          );
          console.log('  Raw chunk:', JSON.stringify(rawChunk, null, 2));
          console.log('  Zod error:', parsed.error.format());
        }

        // Skip unknown chunk types (SDK emits many we don't process)
        if (
          chunkType &&
          ![
            'start',
            'start-step',
            'finish-step',
            'tool-input-start',
            'tool-input-delta',
            'tool-input-end',
            'text-start',
          ].includes(chunkType)
        ) {
          console.log(
            `[VercelAI→Gemini] ⚠️  Chunk #${chunkCount}: Unknown type '${chunkType}' - SKIPPED`,
          );
        }
        continue;
      }

      const chunk = parsed.data;

      if (chunk.type === 'text-delta') {
        // Yield text immediately as it arrives
        const delta = chunk.textDelta;
        textAccumulator += delta;

        console.log(
          `[VercelAI→Gemini] ✅ Chunk #${chunkCount}: text-delta ("${delta}") → Yielding Gemini text part`,
        );

        yield Object.setPrototypeOf(
          {
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: delta }],
                },
                index: 0,
              },
            ],
          },
          GenerateContentResponse.prototype,
        );
      } else if (chunk.type === 'tool-call') {
        // Accumulate tool calls
        // NOTE: SDK uses 'args' property matching ToolCallPart interface
        console.log(
          `[VercelAI→Gemini] ✅ Chunk #${chunkCount}: tool-call (${chunk.toolName}) → Accumulated (will yield at end)`,
        );
        console.log(`  ├─ ID: ${chunk.toolCallId}`);

        // INVESTIGATION: Log the raw chunk to see what we actually receive
        console.log(`  ├─ Raw chunk:`, JSON.stringify(chunk, null, 2));

        if (chunk.args !== undefined) {
          console.log(
            `  └─ Args:`,
            JSON.stringify(chunk.args, null, 2).split('\n').join('\n     '),
          );
        } else {
          console.log(`  └─ Args: undefined (may come in separate chunks)`);
        }

        toolCallsMap.set(chunk.toolCallId, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.args,
        });
      } else if (chunk.type === 'finish') {
        console.log(
          `[VercelAI→Gemini] ✅ Chunk #${chunkCount}: finish (reason: ${chunk.finishReason || 'none'})`,
        );
        finishReason = chunk.finishReason;
      }
    }

    // Get usage metadata after stream completes
    console.log(
      `\n[VercelAI→Gemini] 📊 Stream ended. Total chunks: ${chunkCount}`,
    );
    console.log(`  ├─ Text accumulated: ${textAccumulator.length} chars`);
    console.log(`  └─ Tool calls accumulated: ${toolCallsMap.size}`);

    let usage: VercelUsage | undefined;
    try {
      usage = await getUsage();
      console.log(`[VercelAI→Gemini] ✅ Usage metadata retrieved:`, usage);
    } catch (error) {
      console.warn(
        '[VercelAI→Gemini] ⚠️  Failed to get usage metadata:',
        (error as Error).message,
      );
      // Fallback estimation
      usage = this.estimateUsage(textAccumulator);
    }

    // Yield final response with tool calls and metadata
    if (toolCallsMap.size > 0 || finishReason || usage) {
      const parts: Part[] = [];
      let functionCalls: FunctionCall[] | undefined;

      if (toolCallsMap.size > 0) {
        console.log(
          `\n[VercelAI→Gemini] 🔧 Converting ${toolCallsMap.size} tool calls...`,
        );
        // Convert tool calls using ToolStrategy
        const toolCallsArray = Array.from(toolCallsMap.values());
        functionCalls = this.toolStrategy.vercelToGemini(toolCallsArray);

        console.log(
          `[VercelAI→Gemini] ✅ Converted to ${functionCalls.length} Gemini function calls`,
        );
        for (let i = 0; i < functionCalls.length; i++) {
          const fc = functionCalls[i];
          console.log(`  ${i + 1}. ${fc.name}`);
          console.log(`     ├─ ID: ${fc.id}`);
          console.log(
            `     └─ Args:`,
            JSON.stringify(fc.args, null, 2).split('\n').join('\n        '),
          );
        }

        // Add to parts
        for (const fc of functionCalls) {
          parts.push({ functionCall: fc });
        }
      }

      const usageMetadata = this.convertUsage(usage);

      console.log(`\n[VercelAI→Gemini] 🎯 Yielding final response:`);
      console.log(`  ├─ Parts: ${parts.length}`);
      console.log(
        `  ├─ Function calls (top-level): ${functionCalls?.length || 0}`,
      );
      console.log(`  ├─ Finish reason: ${this.mapFinishReason(finishReason)}`);
      console.log(
        `  └─ Usage: ${usageMetadata?.totalTokenCount || 0} tokens\n`,
      );

      yield Object.setPrototypeOf(
        {
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
        },
        GenerateContentResponse.prototype,
      );
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
    console.warn(
      `[VercelAI] Usage metadata not provided by model, using estimation (${estimatedTokens} tokens)`,
    );

    return {
      promptTokens: 0, // Can't estimate without input
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
   * Create empty response for error cases
   */
  private createEmptyResponse(): GenerateContentResponse {
    return Object.setPrototypeOf(
      {
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
      },
      GenerateContentResponse.prototype,
    );
  }
}
