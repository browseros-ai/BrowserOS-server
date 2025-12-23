/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for ToolConversionStrategy
 *
 * REQUIREMENTS-BASED TESTS
 * These tests verify the adapter meets the type contracts between:
 * - Gemini SDK (@google/genai): FunctionCall, FunctionDeclaration, Tool
 * - Vercel AI SDK (ai): ToolCallPart, VercelTool
 *
 * Key Type Contracts:
 * - FunctionCall.args MUST be Record<string, unknown> (object with string keys)
 * - FunctionCall.id is OPTIONAL (generated if missing)
 * - FunctionDeclaration.description is OPTIONAL (defaults to '')
 * - ToolCallPart.args can be ANY JSON value (object, array, primitive, null)
 * - Conversion must handle invalid inputs gracefully (no throws)
 */

import type { FunctionDeclaration, Schema, Tool } from '@google/genai'
import { Type } from '@google/genai'
import { beforeEach, describe, expect, it as t } from 'vitest'

import { ToolConversionStrategy } from './tool.js'

describe('ToolConversionStrategy', () => {
  let strategy: ToolConversionStrategy

  beforeEach(() => {
    strategy = new ToolConversionStrategy()
  })

  // ========================================
  // GEMINI → VERCEL (Tool Definitions)
  // ========================================

  describe('geminiToVercel', () => {
    t('tests that undefined tools returns undefined', () => {
      const result = strategy.geminiToVercel(undefined)
      expect(result).toBeUndefined()
    })

    t('tests that empty tools array returns undefined', () => {
      const result = strategy.geminiToVercel([])
      expect(result).toBeUndefined()
    })

    t('tests that tools without functionDeclarations returns undefined', () => {
      const tools = [
        { googleSearch: {} } as unknown as Tool,
        { retrieval: {} } as unknown as Tool,
      ]
      const result = strategy.geminiToVercel(tools)
      expect(result).toBeUndefined()
    })

    t(
      'tests that single tool with all properties converts to name-keyed object',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'get_weather',
                description: 'Get weather for a location',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING },
                  },
                  required: ['location'],
                },
              },
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        expect(result).toBeDefined()
        expect(result?.get_weather).toBeDefined()
        expect(result?.get_weather.description).toBe(
          'Get weather for a location',
        )
        expect(result?.get_weather.inputSchema).toBeDefined()
      },
    )

    t(
      'tests that tool without description uses empty string as default',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'simple_tool',
                parameters: { type: Type.OBJECT, properties: {} },
              } as FunctionDeclaration,
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        expect(result?.simple_tool.description).toBe('')
      },
    )

    t(
      'tests that tool without parameters gets normalized with type object',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'no_params_tool',
                description: 'A tool without parameters',
              } as FunctionDeclaration,
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        expect(result?.no_params_tool).toBeDefined()
        expect(result?.no_params_tool.inputSchema).toBeDefined()
      },
    )

    t(
      'tests that multiple tools in one array merge into single name-keyed object',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'tool1',
                description: 'First',
                parameters: { type: Type.OBJECT },
              },
              {
                name: 'tool2',
                description: 'Second',
                parameters: { type: Type.OBJECT },
              },
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        expect(Object.keys(result ?? {})).toHaveLength(2)
        expect(result?.tool1).toBeDefined()
        expect(result?.tool2).toBeDefined()
      },
    )

    t('tests that multiple Tool arrays flatten into one object', () => {
      const tools: Tool[] = [
        {
          functionDeclarations: [
            {
              name: 'tool1',
              description: 'First',
              parameters: { type: Type.OBJECT },
            },
          ],
        },
        {
          functionDeclarations: [
            {
              name: 'tool2',
              description: 'Second',
              parameters: { type: Type.OBJECT },
            },
          ],
        },
      ]

      const result = strategy.geminiToVercel(tools)

      expect(Object.keys(result ?? {})).toHaveLength(2)
      expect(result?.tool1).toBeDefined()
      expect(result?.tool2).toBeDefined()
    })

    t(
      'tests that parameters get normalized to include type object for OpenAI compatibility',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'test_tool',
                description: 'Test',
                parameters: {
                  // Missing 'type' field - should be normalized
                  properties: {
                    arg1: { type: Type.STRING },
                  },
                } as Schema,
              },
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        expect(result?.test_tool.inputSchema).toBeDefined()
      },
    )

    t(
      'tests that parameters is wrapped with jsonSchema function from Vercel SDK',
      () => {
        const tools: Tool[] = [
          {
            functionDeclarations: [
              {
                name: 'test_tool',
                description: 'Test',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING },
                  },
                },
              },
            ],
          },
        ]

        const result = strategy.geminiToVercel(tools)

        // inputSchema should be defined (wrapped with jsonSchema())
        expect(result?.test_tool.inputSchema).toBeDefined()
        expect(typeof result?.test_tool.inputSchema).toBe('object')
      },
    )

    t('tests that nested object parameters preserve full structure', () => {
      const tools: Tool[] = [
        {
          functionDeclarations: [
            {
              name: 'nested_tool',
              description: 'Nested params',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  user: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      age: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          ],
        },
      ]

      const result = strategy.geminiToVercel(tools)

      expect(result?.nested_tool).toBeDefined()
      expect(result?.nested_tool.inputSchema).toBeDefined()
    })

    t('tests that array type parameters convert correctly', () => {
      const tools: Tool[] = [
        {
          functionDeclarations: [
            {
              name: 'array_tool',
              description: 'Takes array',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
              },
            },
          ],
        },
      ]

      const result = strategy.geminiToVercel(tools)

      expect(result?.array_tool).toBeDefined()
    })
  })

  // ========================================
  // VERCEL → GEMINI (Tool Calls)
  // ========================================

  describe('vercelToGemini', () => {
    t('tests that empty array returns empty array', () => {
      const result = strategy.vercelToGemini([])
      expect(result).toEqual([])
    })

    t('tests that valid tool call with object input converts correctly', () => {
      const toolCalls = [
        {
          toolCallId: 'call_123',
          toolName: 'get_weather',
          input: { location: 'Tokyo', units: 'celsius' },
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('call_123')
      expect(result[0].name).toBe('get_weather')
      expect(result[0].args).toEqual({ location: 'Tokyo', units: 'celsius' })
    })

    t('tests that tool call with empty object input converts correctly', () => {
      const toolCalls = [
        {
          toolCallId: 'call_456',
          toolName: 'simple_tool',
          input: {},
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].args).toEqual({})
    })

    // CRITICAL: FunctionCall.args MUST be Record<string, unknown>
    // Arrays violate this type contract and must be converted to {}

    t(
      'tests that tool call with array input converts to empty object per type contract',
      () => {
        const toolCalls = [
          {
            toolCallId: 'call_arr',
            toolName: 'invalid_array_tool',
            input: [1, 2, 3],
          },
        ]

        const result = strategy.vercelToGemini(toolCalls)

        // Arrays violate Record<string, unknown> type contract
        // Must be converted to {} to satisfy FunctionCall.args type
        expect(result[0].args).toEqual({})
        expect(Array.isArray(result[0].args)).toBe(false)
      },
    )

    t('tests that tool call with null input converts to empty object', () => {
      const toolCalls = [
        {
          toolCallId: 'call_null',
          toolName: 'null_tool',
          input: null,
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].args).toEqual({})
    })

    t(
      'tests that tool call with undefined input converts to empty object',
      () => {
        const toolCalls = [
          {
            toolCallId: 'call_undef',
            toolName: 'undef_tool',
            input: undefined,
          },
        ]

        const result = strategy.vercelToGemini(toolCalls)

        expect(result[0].args).toEqual({})
      },
    )

    t('tests that tool call with string input converts to empty object', () => {
      const toolCalls = [
        {
          toolCallId: 'call_str',
          toolName: 'str_tool',
          input: 'not an object',
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].args).toEqual({})
    })

    t('tests that tool call with number input converts to empty object', () => {
      const toolCalls = [
        {
          toolCallId: 'call_num',
          toolName: 'num_tool',
          input: 42,
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].args).toEqual({})
    })

    t(
      'tests that tool call with boolean input converts to empty object',
      () => {
        const toolCalls = [
          {
            toolCallId: 'call_bool',
            toolName: 'bool_tool',
            input: true,
          },
        ]

        const result = strategy.vercelToGemini(toolCalls)

        expect(result[0].args).toEqual({})
      },
    )

    t('tests that tool call with nested object preserves structure', () => {
      const toolCalls = [
        {
          toolCallId: 'call_nested',
          toolName: 'nested_tool',
          input: {
            user: {
              name: 'Alice',
              address: {
                city: 'Tokyo',
                country: 'Japan',
              },
            },
            timestamp: 1234567890,
          },
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].args).toEqual({
        user: {
          name: 'Alice',
          address: {
            city: 'Tokyo',
            country: 'Japan',
          },
        },
        timestamp: 1234567890,
      })
    })

    t('tests that multiple tool calls all convert', () => {
      const toolCalls = [
        { toolCallId: 'call_1', toolName: 'tool1', input: { arg: 'val1' } },
        { toolCallId: 'call_2', toolName: 'tool2', input: { arg: 'val2' } },
        { toolCallId: 'call_3', toolName: 'tool3', input: {} },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('tool1')
      expect(result[1].name).toBe('tool2')
      expect(result[2].name).toBe('tool3')
    })

    t('tests that tool call ID with special characters is preserved', () => {
      const toolCalls = [
        {
          toolCallId: 'call_123-abc_XYZ.v2',
          toolName: 'test_tool',
          input: {},
        },
      ]

      const result = strategy.vercelToGemini(toolCalls)

      expect(result[0].id).toBe('call_123-abc_XYZ.v2')
    })

    // Error handling: Should return fallback, NOT throw

    t(
      'tests that missing toolCallId returns fallback structure without throwing',
      () => {
        const toolCalls = [
          {
            toolName: 'missing_id_tool',
            input: { test: true },
          } as unknown,
        ]

        const result = strategy.vercelToGemini(toolCalls)

        // Should not throw, returns fallback
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('invalid_0')
        expect(result[0].name).toBe('unknown')
        expect(result[0].args).toEqual({})
      },
    )

    t(
      'tests that missing toolName returns fallback structure without throwing',
      () => {
        const toolCalls = [
          {
            toolCallId: 'call_no_name',
            input: { test: true },
          } as unknown,
        ]

        const result = strategy.vercelToGemini(toolCalls)

        // Should not throw, returns fallback
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('invalid_0')
        expect(result[0].name).toBe('unknown')
        expect(result[0].args).toEqual({})
      },
    )

    t(
      'tests that completely invalid tool call returns fallback structure',
      () => {
        const toolCalls = [{ invalid: 'data', random: 123 } as unknown]

        const result = strategy.vercelToGemini(toolCalls)

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('invalid_0')
        expect(result[0].name).toBe('unknown')
        expect(result[0].args).toEqual({})
      },
    )

    t(
      'tests that mix of valid and invalid tool calls all return valid structures',
      () => {
        const toolCalls = [
          { toolCallId: 'call_1', toolName: 'valid_tool', input: { test: 1 } },
          { invalid: 'data' } as unknown,
          {
            toolCallId: 'call_2',
            toolName: 'another_valid',
            input: { test: 2 },
          },
        ]

        const result = strategy.vercelToGemini(toolCalls)

        expect(result).toHaveLength(3)
        expect(result[0].id).toBe('call_1')
        expect(result[0].name).toBe('valid_tool')
        expect(result[1].id).toBe('invalid_1')
        expect(result[1].name).toBe('unknown')
        expect(result[2].id).toBe('call_2')
        expect(result[2].name).toBe('another_valid')
      },
    )
  })
})
