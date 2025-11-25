/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for MessageConversionStrategy
 *
 * REQUIREMENTS-BASED TESTS
 * These tests verify the adapter meets the type contracts between:
 * - Gemini SDK: Content, Part, FunctionCall, FunctionResponse
 * - Vercel AI SDK: CoreMessage (UserModelMessage, AssistantModelMessage, ToolModelMessage)
 *
 * Key Type Contracts:
 * - Content.role: 'user' | 'model' (maps to 'user' | 'assistant' | 'tool')
 * - Content.parts is OPTIONAL (defaults to [])
 * - CoreMessage.content can be: string | Array<Part>
 * - ToolModelMessage.role MUST be 'tool' (not 'user') for function responses
 * - Tool call parts use 'input' property per AI SDK v5 ToolCallPart interface
 * - Tool result parts use 'output' property with structured format per AI SDK v5
 * - Empty messages (no text, no parts) should be skipped
 */

import { describe, it as t, expect, beforeEach } from 'vitest';
import { MessageConversionStrategy } from './message.js';
import type {
  Content,
  FunctionResponse,
  FunctionCall,
  ContentUnion,
} from '@google/genai';
import type {
  VercelContentPart,
  VercelToolResultPart,
  VercelToolCallPart,
} from '../types.js';

describe('MessageConversionStrategy', () => {
  let strategy: MessageConversionStrategy;

  beforeEach(() => {
    strategy = new MessageConversionStrategy();
  });

  // ========================================
  // GEMINI → VERCEL (Conversation History)
  // ========================================

  describe('geminiToVercel', () => {
    // Empty and edge cases

    t('tests that empty contents array returns empty array', () => {
      const result = strategy.geminiToVercel([]);
      expect(result).toEqual([]);
    });

    t('tests that content with undefined parts is skipped', () => {
      const contents: Content[] = [{ role: 'user', parts: undefined }];

      const result = strategy.geminiToVercel(contents);

      expect(result).toHaveLength(0);
    });

    t('tests that content with empty parts array is skipped', () => {
      const contents: Content[] = [{ role: 'user', parts: [] }];

      const result = strategy.geminiToVercel(contents);

      expect(result).toHaveLength(0);
    });

    t(
      'tests that content with no text and no function parts is skipped',
      () => {
        const contents: Content[] = [{ role: 'user', parts: [{ text: '' }] }];

        const result = strategy.geminiToVercel(contents);

        expect(result).toHaveLength(0);
      },
    );

    // Simple text messages

    t('tests that simple user text message converts to string content', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Hello world' }],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello world');
    });

    t('tests that model role maps to assistant role', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [{ text: 'Hi there!' }],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('Hi there!');
    });

    t('tests that multiple text parts join with newline', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Line 1' }, { text: 'Line 2' }, { text: 'Line 3' }],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      expect(result[0].content).toBe('Line 1\nLine 2\nLine 3');
    });

    // Tool result messages (function responses from user)

    t(
      'tests that function response converts to tool role not user role',
      () => {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_123',
                  name: 'get_weather',
                  response: { temperature: 72, condition: 'sunny' },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // CRITICAL: Must be 'tool' role, not 'user'
        expect(result[0].role).toBe('tool');
      },
    );

    t(
      'tests that function response content is array of tool-result parts',
      () => {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_456',
                  name: 'search',
                  response: { results: ['result1', 'result2'] },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        expect(Array.isArray(result[0].content)).toBe(true);
        const content = result[0].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        expect(toolResult.type).toBe('tool-result');
        expect(toolResult.toolCallId).toBe('call_456');
        expect(toolResult.toolName).toBe('search');
      },
    );

    t('tests that function response output contains structured response per v5', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_789',
                name: 'get_data',
                response: { data: 'test', success: true },
              },
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolResult = content[0] as VercelToolResultPart;
      // AI SDK v5 uses structured output format
      expect(toolResult.output).toEqual({ type: 'json', value: { data: 'test', success: true } });
    });

    t(
      'tests that function response with error field uses error output type',
      () => {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_error',
                  name: 'broken_tool',
                  response: { error: 'Something went wrong', code: 500 },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[0].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        // AI SDK v5 uses error-text or error-json for error responses
        expect(toolResult.output).toEqual({
          type: 'error-text',
          value: 'Something went wrong',
        });
      },
    );

    t(
      'tests that function response without response field uses empty json output',
      () => {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_no_response',
                  name: 'simple_tool',
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[0].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        // AI SDK v5 uses structured output format
        expect(toolResult.output).toEqual({ type: 'json', value: {} });
      },
    );

    t('tests that function response without id generates one', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: 'test_tool',
                response: { result: 'ok' },
              } as Partial<FunctionResponse> as FunctionResponse,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolResult = content[0] as VercelToolResultPart;
      expect(toolResult.toolCallId).toBeDefined();
      expect(toolResult.toolCallId).toMatch(/^call_\d+_[a-z0-9]+$/);
    });

    t('tests that function response without name uses unknown', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_no_name',
                response: { result: 'ok' },
              } as Partial<FunctionResponse> as FunctionResponse,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolResult = content[0] as VercelToolResultPart;
      expect(toolResult.toolName).toBe('unknown');
    });

    t(
      'tests that multiple function responses in one message all convert',
      () => {
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_1',
                  name: 'tool1',
                  response: { result: 1 },
                },
              },
              {
                functionResponse: {
                  id: 'call_2',
                  name: 'tool2',
                  response: { result: 2 },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[0].content as VercelContentPart[];
        expect(content).toHaveLength(2);
        const toolResult0 = content[0] as VercelToolResultPart;
        const toolResult1 = content[1] as VercelToolResultPart;
        expect(toolResult0.toolCallId).toBe('call_1');
        expect(toolResult1.toolCallId).toBe('call_2');
      },
    );

    // Assistant messages with tool calls

    t(
      'tests that function call converts to assistant message with tool-call part',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_abc',
                  name: 'search',
                  args: { query: 'test' },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        expect(result[0].role).toBe('assistant');
        const content = result[0].content as VercelContentPart[];
        expect(content).toHaveLength(1);
        const toolCall = content[0] as VercelToolCallPart;
        expect(toolCall.type).toBe('tool-call');
        expect(toolCall.toolCallId).toBe('call_abc');
        expect(toolCall.toolName).toBe('search');
      },
    );

    t(
      'tests that function call uses input property per SDK v5 ToolCallPart interface',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_def',
                  name: 'get_weather',
                  args: { location: 'Tokyo', units: 'celsius' },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[0].content as VercelContentPart[];
        const toolCall = content[0] as VercelToolCallPart;
        // CRITICAL: Must be 'input' per Vercel AI SDK v5's ToolCallPart interface
        expect(toolCall).toHaveProperty('input');
        expect(toolCall.input).toEqual({
          location: 'Tokyo',
          units: 'celsius',
        });
      },
    );

    t(
      'tests that assistant message with text and tool call includes both',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              { text: 'Let me search for that' },
              {
                functionCall: {
                  id: 'call_search',
                  name: 'search',
                  args: { query: 'test' },
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[0].content as VercelContentPart[];
        expect(content).toHaveLength(2);
        expect(content[0].type).toBe('text');
        if ('text' in content[0]) {
          expect(content[0].text).toBe('Let me search for that');
        }
        expect(content[1].type).toBe('tool-call');
      },
    );

    t('tests that function call without id generates one', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'test_tool',
                args: { test: true },
              } as Partial<FunctionCall> as FunctionCall,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolCall = content[0] as VercelToolCallPart;
      expect(toolCall.toolCallId).toBeDefined();
      expect(toolCall.toolCallId).toMatch(/^call_\d+_[a-z0-9]+$/);
    });

    t('tests that function call without name uses unknown', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_xyz',
                args: { test: true },
              } as Partial<FunctionCall> as FunctionCall,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolCall = content[0] as VercelToolCallPart;
      expect(toolCall.toolName).toBe('unknown');
    });

    t('tests that function call without args uses empty object', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_no_args',
                name: 'simple_tool',
              } as Partial<FunctionCall> as FunctionCall,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      const toolCall = content[0] as VercelToolCallPart;
      expect(toolCall.input).toEqual({});
    });

    t('tests that multiple function calls in one message all convert', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_1',
                name: 'tool1',
                args: { arg: 'val1' },
              },
            },
            {
              functionCall: {
                id: 'call_2',
                name: 'tool2',
                args: { arg: 'val2' },
              },
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[0].content as VercelContentPart[];
      expect(content).toHaveLength(2);
      const toolCall0 = content[0] as VercelToolCallPart;
      const toolCall1 = content[1] as VercelToolCallPart;
      expect(toolCall0.toolName).toBe('tool1');
      expect(toolCall1.toolName).toBe('tool2');
    });

    // Multi-turn conversations

    t(
      'tests that multi-turn conversation with mixed message types converts correctly',
      () => {
        const contents: Content[] = [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi! How can I help?' }] },
          { role: 'user', parts: [{ text: 'Search for cats' }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_search',
                  name: 'search',
                  args: { query: 'cats' },
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_search',
                  name: 'search',
                  response: { results: ['cat1', 'cat2'] },
                },
              },
            ],
          },
          { role: 'model', parts: [{ text: 'Found 2 results' }] },
        ];

        const result = strategy.geminiToVercel(contents);

        expect(result).toHaveLength(6);
        expect(result[0].role).toBe('user');
        expect(result[1].role).toBe('assistant');
        expect(result[2].role).toBe('user');
        expect(result[3].role).toBe('assistant');
        expect(result[4].role).toBe('tool'); // Not 'user'!
        expect(result[5].role).toBe('assistant');
      },
    );
  });

  // ========================================
  // SYSTEM INSTRUCTION CONVERSION
  // ========================================

  describe('convertSystemInstruction', () => {
    t('tests that undefined instruction returns undefined', () => {
      const result = strategy.convertSystemInstruction(undefined);
      expect(result).toBeUndefined();
    });

    t('tests that string instruction returns same string', () => {
      const result = strategy.convertSystemInstruction(
        'You are a helpful assistant',
      );
      expect(result).toBe('You are a helpful assistant');
    });

    t(
      'tests that empty string instruction returns undefined per implementation',
      () => {
        const result = strategy.convertSystemInstruction('');
        // Empty strings are falsy, should return undefined
        expect(result).toBeUndefined();
      },
    );

    t(
      'tests that Content object with text parts extracts and joins text',
      () => {
        const instruction = {
          parts: [{ text: 'System instruction here' }],
        };

        const result = strategy.convertSystemInstruction(
          instruction as ContentUnion,
        );

        expect(result).toBe('System instruction here');
      },
    );

    t(
      'tests that Content object with multiple text parts joins with newline',
      () => {
        const instruction = {
          parts: [{ text: 'Line 1' }, { text: 'Line 2' }],
        };

        const result = strategy.convertSystemInstruction(
          instruction as ContentUnion,
        );

        expect(result).toBe('Line 1\nLine 2');
      },
    );

    t('tests that Content object with empty parts returns undefined', () => {
      const instruction = {
        parts: [],
      };

      const result = strategy.convertSystemInstruction(
        instruction as ContentUnion,
      );

      expect(result).toBeUndefined();
    });

    t('tests that Content object with non-text parts returns undefined', () => {
      const instruction = {
        parts: [
          {
            functionCall: {
              id: 'test',
              name: 'test',
              args: {},
            },
          },
        ],
      };

      const result = strategy.convertSystemInstruction(
        instruction as ContentUnion,
      );

      expect(result).toBeUndefined();
    });

    t(
      'tests that Content object with undefined parts returns undefined',
      () => {
        const instruction = {
          parts: undefined,
        };

        const result = strategy.convertSystemInstruction(
          instruction as ContentUnion,
        );

        expect(result).toBeUndefined();
      },
    );

    t('tests that invalid input type returns undefined', () => {
      const result = strategy.convertSystemInstruction(
        123 as unknown as ContentUnion,
      );
      expect(result).toBeUndefined();
    });

    t('tests that null input returns undefined', () => {
      const result = strategy.convertSystemInstruction(
        null as unknown as ContentUnion,
      );
      expect(result).toBeUndefined();
    });
  });
});
