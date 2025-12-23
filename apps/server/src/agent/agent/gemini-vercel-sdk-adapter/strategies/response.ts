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

import {
  FinishReason,
  type FunctionCall,
  type GenerateContentResponse,
  type Part,
} from '@google/genai'
import { Sentry } from '../../../../common/sentry/instrument.js'

import type { ProviderAdapter } from '../adapters/index.js'
import type { ProviderMetadata } from '../adapters/types.js'
import type { VercelFinishReason, VercelUsage } from '../types.js'
import {
  VercelGenerateTextResultSchema,
  VercelStreamChunkSchema,
} from '../types.js'
import type { UIMessageStreamWriter } from '../ui-message-stream.js'

import type { ToolConversionStrategy } from './tool.js'

export class ResponseConversionStrategy {
  constructor(
    private toolStrategy: ToolConversionStrategy,
    private adapter: ProviderAdapter,
  ) {}

  /**
   * Convert Vercel generateText result to Gemini format
   *
   * @param result - Result from Vercel AI generateText()
   * @returns Gemini GenerateContentResponse
   */
  vercelToGemini(result: unknown): GenerateContentResponse {
    // Validate with Zod
    const parsed = VercelGenerateTextResultSchema.safeParse(result)

    if (!parsed.success) {
      // Return minimal valid response
      return this.createEmptyResponse()
    }

    const validated = parsed.data

    const parts: Part[] = []
    let functionCalls: FunctionCall[] | undefined

    // Add text content if present
    if (validated.text) {
      parts.push({ text: validated.text })
    }

    // Convert tool calls using ToolStrategy
    if (validated.toolCalls && validated.toolCalls.length > 0) {
      functionCalls = this.toolStrategy.vercelToGemini(validated.toolCalls)

      // Add to parts (dual representation for Gemini)
      for (const fc of functionCalls) {
        parts.push({ functionCall: fc })
      }
    }

    // Handle usage metadata
    const usageMetadata = this.convertUsage(validated.usage)

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
    } as GenerateContentResponse
  }

  /**
   * Convert Vercel stream to Gemini async generator
   * DUAL OUTPUT: Emits UI Message Stream events + converts to Gemini format
   *
   * @param stream - AsyncIterable of Vercel stream chunks
   * @param getUsage - Function to get usage metadata after stream completes
   * @param uiStream - Optional shared UIMessageStreamWriter (lifecycle managed by caller)
   * @returns AsyncGenerator yielding Gemini responses
   */
  async *streamToGemini(
    stream: AsyncIterable<unknown>,
    getUsage: () => Promise<VercelUsage | undefined>,
    uiStream?: UIMessageStreamWriter,
  ): AsyncGenerator<GenerateContentResponse> {
    let textAccumulator = ''
    const toolCallsMap = new Map<
      string,
      {
        toolCallId: string
        toolName: string
        input: unknown
      }
    >()

    let finishReason: VercelFinishReason | undefined

    // Process stream chunks
    for await (const rawChunk of stream) {
      // Let adapter process chunk (accumulates provider-specific metadata)
      this.adapter.processStreamChunk(rawChunk)

      const chunkType = (rawChunk as { type?: string }).type

      // Handle error chunks first
      if (chunkType === 'error') {
        const errorChunk = rawChunk as { error?: { message?: string } | string }
        const errorMessage =
          typeof errorChunk.error === 'object'
            ? errorChunk.error?.message
            : errorChunk.error || 'Unknown error from LLM provider'
        Sentry.captureException(new Error(errorMessage))
        if (uiStream) {
          await uiStream.writeError(errorMessage || 'Unknown error')
          await uiStream.finish('error')
        }
        throw new Error(`LLM Provider Error: ${errorMessage}`)
      }

      // Try to parse as known chunk type
      const parsed = VercelStreamChunkSchema.safeParse(rawChunk)

      if (!parsed.success) {
        // Skip unknown chunk types (SDK emits many we don't process)
        continue
      }

      const chunk = parsed.data

      if (chunk.type === 'text-delta') {
        const delta = chunk.text
        textAccumulator += delta

        // Emit UI Message Stream format
        if (uiStream) {
          await uiStream.writeTextDelta(delta)
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
        } as GenerateContentResponse
      } else if (chunk.type === 'tool-call') {
        // Emit UI Message Stream format for tool calls
        if (uiStream) {
          await uiStream.writeToolCall(
            chunk.toolCallId,
            chunk.toolName,
            chunk.input,
          )
        }

        toolCallsMap.set(chunk.toolCallId, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input,
        })
      } else if (chunk.type === 'finish') {
        finishReason = chunk.finishReason
      }
      // reasoning-delta and reasoning-start are handled by adapter.processStreamChunk()
    }

    // Get usage metadata after stream completes
    let usage: VercelUsage | undefined
    try {
      usage = await getUsage()
    } catch {
      // Fallback estimation
      usage = this.estimateUsage(textAccumulator)
    }

    // Get provider metadata from adapter (if any was accumulated)
    const providerMetadata = this.adapter.getResponseMetadata()

    // Yield final response with tool calls and metadata
    if (toolCallsMap.size > 0 || finishReason || usage) {
      const parts: Part[] = []
      let functionCalls: FunctionCall[] | undefined

      if (toolCallsMap.size > 0) {
        // Convert tool calls using ToolStrategy
        const toolCallsArray = Array.from(toolCallsMap.values())
        functionCalls = this.toolStrategy.vercelToGemini(toolCallsArray)

        // Attach provider metadata to first functionCall part
        let isFirst = true
        for (const fc of functionCalls) {
          const part: Part & { providerMetadata?: ProviderMetadata } = {
            functionCall: fc,
          }
          if (isFirst && providerMetadata) {
            part.providerMetadata = providerMetadata
            isFirst = false
          }
          parts.push(part)
        }
      }

      const usageMetadata = this.convertUsage(usage)

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
        ...(functionCalls && functionCalls.length > 0 ? { functionCalls } : {}),
        usageMetadata,
      } as GenerateContentResponse
    }
  }

  /**
   * Convert usage metadata from AI SDK format to Gemini format
   * AI SDK uses inputTokens/outputTokens, Gemini uses promptTokenCount/candidatesTokenCount
   */
  private convertUsage(usage: VercelUsage | undefined):
    | {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
      }
    | undefined {
    if (!usage) {
      return undefined
    }

    return {
      promptTokenCount: usage.inputTokens ?? 0,
      candidatesTokenCount: usage.outputTokens ?? 0,
      totalTokenCount: usage.totalTokens ?? 0,
    }
  }

  /**
   * Estimate usage when not provided by model
   */
  private estimateUsage(text: string): VercelUsage {
    const estimatedTokens = Math.ceil(text.length / 4)
    return {
      inputTokens: 0,
      outputTokens: estimatedTokens,
      totalTokens: estimatedTokens,
    }
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
        return FinishReason.STOP
      case 'length':
      case 'max-tokens':
        return FinishReason.MAX_TOKENS
      case 'content-filter':
        return FinishReason.SAFETY
      case 'error':
      case 'other':
      case 'unknown':
        return FinishReason.OTHER
      default:
        return FinishReason.STOP
    }
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
    } as GenerateContentResponse
  }
}
