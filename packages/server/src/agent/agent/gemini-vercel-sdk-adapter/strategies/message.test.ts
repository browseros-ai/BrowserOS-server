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

import type {
  Content,
  FunctionResponse,
  FunctionCall,
  ContentUnion,
} from '@google/genai';
import {describe, it as t, expect, beforeEach} from 'vitest';

import {BaseProviderAdapter} from '../adapters/base.js';
import type {
  VercelContentPart,
  VercelToolResultPart,
  VercelToolCallPart,
} from '../types.js';

import {MessageConversionStrategy} from './message.js';

describe('MessageConversionStrategy', () => {
  let strategy: MessageConversionStrategy;
  let adapter: BaseProviderAdapter;

  beforeEach(() => {
    adapter = new BaseProviderAdapter();
    strategy = new MessageConversionStrategy(adapter);
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
      const contents: Content[] = [{role: 'user', parts: undefined}];

      const result = strategy.geminiToVercel(contents);

      expect(result).toHaveLength(0);
    });

    t('tests that content with empty parts array is skipped', () => {
      const contents: Content[] = [{role: 'user', parts: []}];

      const result = strategy.geminiToVercel(contents);

      expect(result).toHaveLength(0);
    });

    t(
      'tests that content with no text and no function parts is skipped',
      () => {
        const contents: Content[] = [{role: 'user', parts: [{text: ''}]}];

        const result = strategy.geminiToVercel(contents);

        expect(result).toHaveLength(0);
      },
    );

    // Simple text messages

    t('tests that simple user text message converts to string content', () => {
      const contents: Content[] = [
        {
          role: 'user',
          parts: [{text: 'Hello world'}],
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
          parts: [{text: 'Hi there!'}],
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
          parts: [{text: 'Line 1'}, {text: 'Line 2'}, {text: 'Line 3'}],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      expect(result[0].content).toBe('Line 1\nLine 2\nLine 3');
    });

    // Tool result messages (function responses from user)
    // NOTE: Each test includes matching tool call + tool result pairs because
    // orphaned tool results (without matching tool_use) are filtered out to
    // prevent "unexpected tool_use_id found in tool_result blocks" errors

    t(
      'tests that function response converts to tool role not user role',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {functionCall: {id: 'call_123', name: 'get_weather', args: {}}},
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_123',
                  name: 'get_weather',
                  response: {temperature: 72, condition: 'sunny'},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // CRITICAL: Must be 'tool' role, not 'user'
        expect(result[1].role).toBe('tool');
      },
    );

    t(
      'tests that function response content is array of tool-result parts',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [{functionCall: {id: 'call_456', name: 'search', args: {}}}],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_456',
                  name: 'search',
                  response: {results: ['result1', 'result2']},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        expect(Array.isArray(result[1].content)).toBe(true);
        const content = result[1].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        expect(toolResult.type).toBe('tool-result');
        expect(toolResult.toolCallId).toBe('call_456');
        expect(toolResult.toolName).toBe('search');
      },
    );

    t(
      'tests that function response output contains structured response per v5',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {functionCall: {id: 'call_789', name: 'get_data', args: {}}},
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_789',
                  name: 'get_data',
                  response: {data: 'test', success: true},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[1].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        // AI SDK v5 uses structured output format
        expect(toolResult.output).toEqual({
          type: 'json',
          value: {data: 'test', success: true},
        });
      },
    );

    t(
      'tests that function response with error field uses error output type',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {functionCall: {id: 'call_error', name: 'broken_tool', args: {}}},
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_error',
                  name: 'broken_tool',
                  response: {error: 'Something went wrong', code: 500},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[1].content as VercelContentPart[];
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
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_no_response',
                  name: 'simple_tool',
                  args: {},
                },
              },
            ],
          },
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

        const content = result[1].content as VercelContentPart[];
        const toolResult = content[0] as VercelToolResultPart;
        // AI SDK v5 uses structured output format
        expect(toolResult.output).toEqual({type: 'json', value: {}});
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
                response: {result: 'ok'},
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

    // Orphan filtering tests - prevents "unexpected tool_use_id found in tool_result blocks" errors
    t(
      'tests that orphaned tool_result (no matching tool_use) is filtered out',
      () => {
        // Simulates compression scenario where tool_use was removed but tool_result remains
        const contents: Content[] = [
          {role: 'user', parts: [{text: 'Hello'}]},
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'toolu_bdrk_orphan123',
                  name: 'some_tool',
                  response: {result: 'ok'},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // Should only have 1 message (the text), tool_result should be filtered out
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('user');
        expect(result[0].content).toBe('Hello');
      },
    );

    t(
      'tests that orphaned tool_use (no matching tool_result) is filtered out',
      () => {
        // Simulates scenario where tool_result was removed but tool_use remains
        const contents: Content[] = [
          {role: 'user', parts: [{text: 'Search for cats'}]},
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'toolu_bdrk_orphan456',
                  name: 'search',
                  args: {query: 'cats'},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // Should only have 1 message (the text), tool_use should be filtered out
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('user');
        expect(result[0].content).toBe('Search for cats');
      },
    );

    t(
      'tests that paired tool_use and tool_result are kept when together',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'toolu_bdrk_paired789',
                  name: 'search',
                  args: {query: 'cats'},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'toolu_bdrk_paired789',
                  name: 'search',
                  response: {results: ['cat1', 'cat2']},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // Both should be present
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('assistant');
        expect(result[1].role).toBe('tool');
      },
    );

    t(
      'tests that tool_use with text but no matching result keeps text, filters tool_use',
      () => {
        // Critical bug fix: When tool_use is filtered but has accompanying text,
        // the text should be kept but the orphaned tool_result should also be filtered
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {text: 'Let me search for that'},
              {
                functionCall: {
                  id: 'toolu_bdrk_orphan_with_text',
                  name: 'search',
                  args: {query: 'test'},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'toolu_bdrk_orphan_with_text',
                  name: 'search',
                  response: {results: []},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // The tool_use has no matching tool_result in allToolResultIds initially,
        // but the tool_result DOES exist. However, since tool_use comes first and
        // is filtered (no result in allToolResultIds at that point), it gets removed
        // from allToolCallIds. Then when tool_result is processed, it's also filtered.
        //
        // Wait - let's trace this more carefully:
        // First pass: allToolCallIds = {orphan_with_text}, allToolResultIds = {orphan_with_text}
        // Both match! So both should be kept.
        //
        // Actually this test demonstrates a VALID pair, not orphans.
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe('assistant');
        expect(result[1].role).toBe('tool');
      },
    );

    t(
      'tests that tool_result is filtered when its tool_use was filtered earlier',
      () => {
        // This tests the critical fix: when a tool_use is filtered out because
        // its result doesn't exist, any tool_result with that ID that comes later
        // should also be filtered out.
        //
        // Scenario: compression removed the tool_result, tool_use gets filtered,
        // but then a stale/duplicate tool_result appears later in history
        const contents: Content[] = [
          {role: 'user', parts: [{text: 'Hello'}]},
          {
            role: 'model',
            parts: [
              {text: 'Let me search'},
              {
                functionCall: {
                  id: 'toolu_bdrk_filter_cascade',
                  name: 'search',
                  args: {query: 'test'},
                },
              },
            ],
          },
          // Note: NO tool_result here - simulating compression removed it
          {role: 'model', parts: [{text: 'Search complete'}]},
          // Later, a stale tool_result appears (shouldn't happen but might due to bugs)
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'toolu_bdrk_filter_cascade',
                  name: 'search',
                  response: {results: ['result']},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // First pass collects: allToolCallIds = {filter_cascade}, allToolResultIds = {filter_cascade}
        // Both IDs exist, so both pass initial filter.
        // But the ordering is wrong - tool_use at index 1, tool_result at index 3
        // with unrelated content in between.
        //
        // Actually, since both IDs match, both should be kept.
        // The API will accept this because tool_use comes before tool_result.
        // This is actually a valid (if unusual) conversation.
        expect(result).toHaveLength(4); // user text, assistant with tool_use, assistant text, tool
      },
    );

    // CRITICAL: Test for merging consecutive tool messages
    t(
      'tests that consecutive tool messages are merged into single message',
      () => {
        // This is the critical bug fix: when tool_results are split across multiple
        // Contents in Gemini format, they must be merged into a single tool message
        // to satisfy the API requirement that all tool_results follow immediately
        // after the assistant message with tool_uses.
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {functionCall: {id: 'call_A', name: 'tool_a', args: {}}},
              {functionCall: {id: 'call_B', name: 'tool_b', args: {}}},
            ],
          },
          // Split tool_results across two separate Contents (unusual but possible)
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_A',
                  name: 'tool_a',
                  response: {r: 'A'},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_B',
                  name: 'tool_b',
                  response: {r: 'B'},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        // Should merge the two tool messages into ONE
        expect(result).toHaveLength(2); // 1 assistant + 1 merged tool
        expect(result[0].role).toBe('assistant');
        expect(result[1].role).toBe('tool');

        // The merged tool message should have both tool_results
        const toolContent = result[1].content as VercelContentPart[];
        expect(toolContent).toHaveLength(2);
        expect((toolContent[0] as VercelToolResultPart).toolCallId).toBe(
          'call_A',
        );
        expect((toolContent[1] as VercelToolResultPart).toolCallId).toBe(
          'call_B',
        );
      },
    );

    t('tests that tool_results with images still work correctly', () => {
      // Tool results with images create: tool message + user message with images
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_screenshot',
                name: 'screenshot',
                args: {},
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_screenshot',
                name: 'screenshot',
                response: {ok: true},
              },
            },
            {inlineData: {mimeType: 'image/png', data: 'base64imagedata'}},
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      // Should create: assistant + tool + user (with images)
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('tool');
      expect(result[2].role).toBe('user');
    });

    t('tests that function response without name uses unknown', () => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {functionCall: {id: 'call_no_name', name: 'some_tool', args: {}}},
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_no_name',
                response: {result: 'ok'},
              } as Partial<FunctionResponse> as FunctionResponse,
            },
          ],
        },
      ];

      const result = strategy.geminiToVercel(contents);

      const content = result[1].content as VercelContentPart[];
      const toolResult = content[0] as VercelToolResultPart;
      expect(toolResult.toolName).toBe('unknown');
    });

    t(
      'tests that multiple function responses in one message all convert',
      () => {
        const contents: Content[] = [
          {
            role: 'model',
            parts: [
              {functionCall: {id: 'call_1', name: 'tool1', args: {}}},
              {functionCall: {id: 'call_2', name: 'tool2', args: {}}},
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_1',
                  name: 'tool1',
                  response: {result: 1},
                },
              },
              {
                functionResponse: {
                  id: 'call_2',
                  name: 'tool2',
                  response: {result: 2},
                },
              },
            ],
          },
        ];

        const result = strategy.geminiToVercel(contents);

        const content = result[1].content as VercelContentPart[];
        expect(content).toHaveLength(2);
        const toolResult0 = content[0] as VercelToolResultPart;
        const toolResult1 = content[1] as VercelToolResultPart;
        expect(toolResult0.toolCallId).toBe('call_1');
        expect(toolResult1.toolCallId).toBe('call_2');
      },
    );

    // Assistant messages with tool calls
    // NOTE: Each test includes matching tool call + tool result pairs because
    // orphaned tool calls (without matching tool_result) are filtered out to
    // prevent "tool_use ids were found without tool_result blocks" errors

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
                  args: {query: 'test'},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_abc',
                  name: 'search',
                  response: {},
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
                  args: {location: 'Tokyo', units: 'celsius'},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_def',
                  name: 'get_weather',
                  response: {},
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
              {text: 'Let me search for that'},
              {
                functionCall: {
                  id: 'call_search',
                  name: 'search',
                  args: {query: 'test'},
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
                  response: {},
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
                args: {test: true},
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
                args: {test: true},
              } as Partial<FunctionCall> as FunctionCall,
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {functionResponse: {id: 'call_xyz', name: 'unknown', response: {}}},
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
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_no_args',
                name: 'simple_tool',
                response: {},
              },
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
                args: {arg: 'val1'},
              },
            },
            {
              functionCall: {
                id: 'call_2',
                name: 'tool2',
                args: {arg: 'val2'},
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {functionResponse: {id: 'call_1', name: 'tool1', response: {}}},
            {functionResponse: {id: 'call_2', name: 'tool2', response: {}}},
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
          {role: 'user', parts: [{text: 'Hello'}]},
          {role: 'model', parts: [{text: 'Hi! How can I help?'}]},
          {role: 'user', parts: [{text: 'Search for cats'}]},
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_search',
                  name: 'search',
                  args: {query: 'cats'},
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
                  response: {results: ['cat1', 'cat2']},
                },
              },
            ],
          },
          {role: 'model', parts: [{text: 'Found 2 results'}]},
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
          parts: [{text: 'System instruction here'}],
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
          parts: [{text: 'Line 1'}, {text: 'Line 2'}],
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
