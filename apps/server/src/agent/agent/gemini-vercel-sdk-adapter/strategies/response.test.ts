/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for ResponseConversionStrategy
 *
 * REQUIREMENTS-BASED TESTS
 * These tests verify the adapter meets the type contracts between:
 * - Vercel AI SDK: generateText result, stream chunks
 * - Gemini SDK: GenerateContentResponse
 *
 * Key Type Contracts:
 * - Response MUST include functionCalls at TOP LEVEL (not just in parts)
 * - FinishReason mapping: stop/tool-calls→STOP, length/max-tokens→MAX_TOKENS, etc.
 * - Usage metadata fields are OPTIONAL (can be undefined)
 * - Stream chunks: text-delta (yield immediately), tool-call (accumulate), finish
 * - Usage retrieval is ASYNC and happens AFTER stream (may fail)
 */

import type { GenerateContentResponse } from '@google/genai'
import { FinishReason } from '@google/genai'
import { beforeEach, describe, expect, it as t } from 'vitest'

import { BaseProviderAdapter } from '../adapters/base.js'

import { ResponseConversionStrategy } from './response.js'
import { ToolConversionStrategy } from './tool.js'

describe('ResponseConversionStrategy', () => {
  let strategy: ResponseConversionStrategy
  let toolStrategy: ToolConversionStrategy
  let adapter: BaseProviderAdapter

  beforeEach(() => {
    toolStrategy = new ToolConversionStrategy()
    adapter = new BaseProviderAdapter()
    strategy = new ResponseConversionStrategy(toolStrategy, adapter)
  })

  // ========================================
  // NON-STREAMING CONVERSION
  // ========================================

  describe('vercelToGemini (non-streaming)', () => {
    t('tests that simple text result converts to Gemini response', () => {
      const vercelResult = {
        text: 'Hello world',
        finishReason: 'stop' as const,
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.candidates).toBeDefined()
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates?.[0].content?.role).toBe('model')
      expect(result.candidates?.[0].content?.parts).toHaveLength(1)
      expect(result.candidates?.[0].content?.parts?.[0]).toEqual({
        text: 'Hello world',
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP)
      expect(result.candidates?.[0]?.index).toBe(0)
    })

    t('tests that usage metadata maps correctly', () => {
      const vercelResult = {
        text: 'Test',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.usageMetadata).toBeDefined()
      expect(result.usageMetadata?.promptTokenCount).toBe(100)
      expect(result.usageMetadata?.candidatesTokenCount).toBe(50)
      expect(result.usageMetadata?.totalTokenCount).toBe(150)
    })

    t(
      'tests that result with tool calls includes functionCalls at top level',
      () => {
        const vercelResult = {
          text: '',
          toolCalls: [
            {
              toolCallId: 'call_123',
              toolName: 'get_weather',
              input: { location: 'Tokyo' },
            },
          ],
          finishReason: 'tool-calls' as const,
        }

        const result = strategy.vercelToGemini(vercelResult)

        // CRITICAL: Must have functionCalls at TOP LEVEL for turn.ts
        expect(result.functionCalls).toBeDefined()
        expect(result.functionCalls).toHaveLength(1)
        expect(result.functionCalls?.[0].id).toBe('call_123')
        expect(result.functionCalls?.[0].name).toBe('get_weather')
        expect(result.functionCalls?.[0].args).toEqual({ location: 'Tokyo' })
      },
    )

    t(
      'tests that tool calls appear in both parts and top-level functionCalls',
      () => {
        const vercelResult = {
          text: '',
          toolCalls: [
            {
              toolCallId: 'call_456',
              toolName: 'search',
              input: { query: 'test' },
            },
          ],
        }

        const result = strategy.vercelToGemini(vercelResult)

        // Should be in parts
        expect(result.candidates?.[0].content?.parts).toHaveLength(1)
        expect(result.candidates?.[0].content?.parts?.[0]).toHaveProperty(
          'functionCall',
        )

        // Should ALSO be at top level
        expect(result.functionCalls).toHaveLength(1)
        expect(result.functionCalls?.[0].name).toBe('search')
      },
    )

    t('tests that text and tool calls both appear in parts', () => {
      const vercelResult = {
        text: 'Let me check the weather',
        toolCalls: [
          {
            toolCallId: 'call_789',
            toolName: 'get_weather',
            input: { location: 'Paris' },
          },
        ],
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.candidates?.[0].content?.parts).toHaveLength(2)
      expect(result.candidates?.[0].content?.parts?.[0]).toEqual({
        text: 'Let me check the weather',
      })
      expect(result.candidates?.[0].content?.parts?.[1]).toHaveProperty(
        'functionCall',
      )
    })

    t('tests that multiple tool calls all convert', () => {
      const vercelResult = {
        text: '',
        toolCalls: [
          { toolCallId: 'call_1', toolName: 'tool1', input: { arg: 'val1' } },
          { toolCallId: 'call_2', toolName: 'tool2', input: { arg: 'val2' } },
        ],
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.functionCalls).toHaveLength(2)
      expect(result.candidates?.[0].content?.parts).toHaveLength(2)
    })

    t('tests that empty text is not included in parts', () => {
      const vercelResult = {
        text: '',
        finishReason: 'stop' as const,
      }

      const result = strategy.vercelToGemini(vercelResult)

      // Empty text should be skipped
      expect(result.candidates?.[0].content?.parts).toHaveLength(0)
    })

    t('tests that missing usage returns undefined usageMetadata', () => {
      const vercelResult = {
        text: 'Test',
        finishReason: 'stop' as const,
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.usageMetadata).toBeUndefined()
    })

    t('tests that usage with undefined fields defaults to 0', () => {
      // The adapter's getUsage now provides estimates, but convertUsage still defaults to 0
      // for any undefined fields passed through
      const vercelResult = {
        text: 'Test',
        usage: {
          inputTokens: undefined,
          outputTokens: 5,
          totalTokens: undefined,
        },
      }

      const result = strategy.vercelToGemini(vercelResult)

      expect(result.usageMetadata?.promptTokenCount).toBe(0)
      expect(result.usageMetadata?.candidatesTokenCount).toBe(5)
      expect(result.usageMetadata?.totalTokenCount).toBe(0)
    })

    // Finish reason mapping tests

    t('tests that stop finish reason maps to STOP', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'stop' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP)
    })

    t('tests that tool-calls finish reason maps to STOP', () => {
      const result = strategy.vercelToGemini({
        text: '',
        toolCalls: [{ toolCallId: 'call_1', toolName: 'tool', input: {} }],
        finishReason: 'tool-calls' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP)
    })

    t('tests that length finish reason maps to MAX_TOKENS', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'length' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.MAX_TOKENS)
    })

    t('tests that max-tokens finish reason maps to MAX_TOKENS', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'max-tokens' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.MAX_TOKENS)
    })

    t('tests that content-filter finish reason maps to SAFETY', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'content-filter' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.SAFETY)
    })

    t('tests that error finish reason maps to OTHER', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'error' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.OTHER)
    })

    t('tests that other finish reason maps to OTHER', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'other' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.OTHER)
    })

    t('tests that unknown finish reason maps to OTHER', () => {
      const result = strategy.vercelToGemini({
        text: 'Test',
        finishReason: 'unknown' as const,
      })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.OTHER)
    })

    t('tests that undefined finish reason defaults to STOP', () => {
      const result = strategy.vercelToGemini({ text: 'Test' })
      expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.STOP)
    })

    t(
      'tests that invalid result returns empty response without throwing',
      () => {
        const invalidResult = {
          // Missing required 'text' field
          finishReason: 'stop',
        }

        const result = strategy.vercelToGemini(invalidResult)

        expect(result.candidates).toHaveLength(1)
        expect(result.candidates?.[0].content?.parts).toHaveLength(1)
        expect(result.candidates?.[0].content?.parts?.[0]).toEqual({ text: '' })
        expect(result.candidates?.[0]?.finishReason).toBe(FinishReason.OTHER)
      },
    )
  })

  // ========================================
  // STREAMING CONVERSION
  // ========================================

  describe('streamToGemini (streaming)', () => {
    t(
      'tests that stream with text-delta chunks yields immediately',
      async () => {
        const stream = (async function* () {
          yield { type: 'text-delta', text: 'Hello' }
          yield { type: 'text-delta', text: ' world' }
          yield { type: 'finish', finishReason: 'stop' as const }
        })()

        const getUsage = async () => ({ totalTokens: 5 })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        // Should yield text chunks immediately
        expect(chunks.length).toBeGreaterThanOrEqual(2)
        expect(chunks[0]?.candidates?.[0]?.content?.parts?.[0].text).toBe(
          'Hello',
        )
        expect(chunks[1]?.candidates?.[0]?.content?.parts?.[0].text).toBe(
          ' world',
        )
      },
    )

    t(
      'tests that stream with tool-call chunks accumulates and yields at end',
      async () => {
        const stream = (async function* () {
          yield {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            input: { location: 'Tokyo' },
          }
          yield { type: 'finish', finishReason: 'tool-calls' as const }
        })()

        const getUsage = async () => ({ totalTokens: 10 })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        // Should yield final chunk with tool calls
        const finalChunk = chunks[chunks.length - 1]
        expect(finalChunk?.functionCalls).toBeDefined()
        expect(finalChunk?.functionCalls).toHaveLength(1)
        expect(finalChunk?.functionCalls?.[0].name).toBe('get_weather')
      },
    )

    t(
      'tests that stream with multiple tool calls accumulates all',
      async () => {
        const stream = (async function* () {
          yield {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'tool1',
            input: { arg: 'val1' },
          }
          yield {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'tool2',
            input: { arg: 'val2' },
          }
          yield { type: 'finish', finishReason: 'tool-calls' as const }
        })()

        const getUsage = async () => ({ totalTokens: 15 })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        const finalChunk = chunks[chunks.length - 1]
        expect(finalChunk?.functionCalls).toHaveLength(2)
      },
    )

    t('tests that stream with text and tool calls yields both', async () => {
      const stream = (async function* () {
        yield { type: 'text-delta', text: 'Searching...' }
        yield {
          type: 'tool-call',
          toolCallId: 'call_search',
          toolName: 'search',
          input: { query: 'test' },
        }
        yield { type: 'finish', finishReason: 'tool-calls' as const }
      })()

      const getUsage = async () => ({ totalTokens: 20 })

      const chunks: GenerateContentResponse[] = []
      for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      // First chunk is text
      expect(chunks[0]?.candidates?.[0]?.content?.parts?.[0]).toHaveProperty(
        'text',
      )
      // Last chunk has tool calls
      expect(chunks[chunks.length - 1].functionCalls).toHaveLength(1)
    })

    t(
      'tests that stream with unknown chunk types skips them gracefully',
      async () => {
        const stream = (async function* () {
          yield { type: 'start' } as unknown // Unknown type
          yield { type: 'text-delta', text: 'Hello' }
          yield { type: 'step-finish' } as unknown // Unknown type
          yield { type: 'finish', finishReason: 'stop' as const }
        })()

        const getUsage = async () => ({ totalTokens: 5 })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        // Should only process text-delta and finish
        expect(chunks.length).toBeGreaterThanOrEqual(1)
      },
    )

    t('tests that stream with empty text-delta still yields', async () => {
      const stream = (async function* () {
        yield { type: 'text-delta', text: '' }
        yield { type: 'finish', finishReason: 'stop' as const }
      })()

      const getUsage = async () => ({ totalTokens: 0 })

      const chunks: GenerateContentResponse[] = []
      for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      expect(chunks[0]?.candidates?.[0]?.content?.parts?.[0].text).toBe('')
    })

    t('tests that stream without finish reason still completes', async () => {
      const stream = (async function* () {
        yield { type: 'text-delta', text: 'Test' }
        // No finish chunk
      })()

      const getUsage = async () => ({ totalTokens: 5 })

      const chunks: GenerateContentResponse[] = []
      for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    t(
      'tests that stream with getUsage error uses estimation fallback',
      async () => {
        const stream = (async function* () {
          yield { type: 'text-delta', text: 'Test message here' }
          yield { type: 'finish', finishReason: 'stop' as const }
        })()

        const getUsage = async () => {
          throw new Error('Usage not available')
        }

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        // Should still complete with estimated usage
        const finalChunk = chunks[chunks.length - 1]
        expect(finalChunk?.usageMetadata?.totalTokenCount).toBeGreaterThan(0)
      },
    )

    t(
      'tests that stream with no content yields final metadata chunk',
      async () => {
        const stream = (async function* () {
          // Empty stream
        })()

        const getUsage = async () => ({ totalTokens: 0 })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        // Should yield final chunk with metadata
        expect(chunks.length).toBe(1)
        expect(chunks[0].usageMetadata).toBeDefined()
      },
    )

    t(
      'tests that stream usage metadata is included in final chunk',
      async () => {
        const stream = (async function* () {
          yield { type: 'text-delta', text: 'Test' }
          yield { type: 'finish', finishReason: 'stop' as const }
        })()

        const getUsage = async () => ({
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        })

        const chunks: GenerateContentResponse[] = []
        for await (const chunk of strategy.streamToGemini(stream, getUsage)) {
          chunks.push(chunk)
        }

        const finalChunk = chunks[chunks.length - 1]
        expect(finalChunk?.usageMetadata?.promptTokenCount).toBe(10)
        expect(finalChunk?.usageMetadata?.candidatesTokenCount).toBe(5)
        expect(finalChunk?.usageMetadata?.totalTokenCount).toBe(15)
      },
    )
  })
})
