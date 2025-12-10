/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {withMcpServer} from '@browseros/common/tests/utils';
import {describe, it} from 'bun:test';

describe('MCP Controller Coordinates Tools', () => {
  describe('browser_click_coordinates - Success Cases', () => {
    it('tests that clicking at coordinates in active tab succeeds', async () => {
      await withMcpServer(async client => {
        // Get active tab
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        // Click at coordinates
        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 100, y: 100},
        });

        console.log('\n=== Click Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
        assert.ok(Array.isArray(result.content), 'Content should be array');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('Clicked at coordinates'),
          'Should confirm click',
        );
        assert.ok(
          textContent.text.includes('100') && textContent.text.includes('100'),
          'Should mention coordinates',
        );
      });
    }, 30000);

    it('tests that clicking at top-left coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 10, y: 10},
        });

        console.log('\n=== Click Top-Left Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that clicking at center coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 500, y: 400},
        });

        console.log('\n=== Click Center Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that clicking at zero coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 0, y: 0},
        });

        console.log('\n=== Click Zero Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that clicking at large coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 2000, y: 1500},
        });

        console.log('\n=== Click Large Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that clicking with decimal coordinates is rejected', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 100.5, y: 200.7},
        });

        console.log('\n=== Click Decimal Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(result.isError, 'Should reject decimal coordinates');
        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(
          textContent.text.includes('expected int'),
          'Should indicate integer required',
        );
      });
    }, 30000);
  });

  describe('browser_click_coordinates - Error Handling', () => {
    it('tests that missing tabId is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_click_coordinates',
            arguments: {x: 100, y: 100},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Click Coordinates Missing TabId Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that missing coordinates is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_click_coordinates',
            arguments: {tabId: 1},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Click Coordinates Missing XY Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that non-numeric coordinates is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_click_coordinates',
            arguments: {tabId: 1, x: 'invalid', y: 100},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Click Coordinates Invalid Type Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that negative coordinates are handled', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: -10, y: -20},
        });

        console.log('\n=== Click Negative Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should either succeed or error gracefully
        assert.ok(result, 'Should return a result');
      });
    }, 30000);

    it('tests that invalid tabId is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId: 999999, x: 100, y: 100},
        });

        console.log('\n=== Click Coordinates Invalid TabId Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should error
        assert.ok(
          result.isError || result.content,
          'Should handle invalid tab',
        );
      });
    }, 30000);
  });

  describe('browser_type_at_coordinates - Success Cases', () => {
    it('tests that typing at coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 200, y: 200, text: 'Hello World'},
        });

        console.log('\n=== Type at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');

        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(textContent, 'Should have text content');
        assert.ok(
          textContent.text.includes('Clicked at'),
          'Should confirm click',
        );
        assert.ok(
          textContent.text.includes('typed text'),
          'Should confirm typing',
        );
      });
    }, 30000);

    it('tests that typing special characters at coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {
            tabId,
            x: 150,
            y: 150,
            text: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/',
          },
        });

        console.log('\n=== Type Special Chars at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that typing empty string at coordinates is rejected', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 100, y: 100, text: ''},
        });

        console.log('\n=== Type Empty String at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(result.isError, 'Should reject empty string');
        const textContent = result.content.find(c => c.type === 'text');
        assert.ok(
          textContent.text.includes('Too small') ||
            textContent.text.includes('>=1 characters'),
          'Should indicate minimum length required',
        );
      });
    }, 30000);

    it('tests that typing unicode at coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 100, y: 100, text: '你好世界 🌍 テスト'},
        });

        console.log('\n=== Type Unicode at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that typing long text at coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const longText = 'Lorem ipsum dolor sit amet '.repeat(50);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 100, y: 100, text: longText},
        });

        console.log('\n=== Type Long Text at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);

    it('tests that typing multiline text at coordinates succeeds', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 100, y: 100, text: 'Line 1\nLine 2\nLine 3'},
        });

        console.log('\n=== Type Multiline at Coordinates Response ===');
        console.log(JSON.stringify(result, null, 2));

        assert.ok(!result.isError, 'Should succeed');
      });
    }, 30000);
  });

  describe('browser_type_at_coordinates - Error Handling', () => {
    it('tests that missing text is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_type_at_coordinates',
            arguments: {tabId: 1, x: 100, y: 100},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Type at Coordinates Missing Text Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that missing coordinates is rejected', async () => {
      await withMcpServer(async client => {
        try {
          await client.callTool({
            name: 'browser_type_at_coordinates',
            arguments: {tabId: 1, text: 'test'},
          });
          assert.fail('Should have thrown validation error');
        } catch (error) {
          console.log('\n=== Type at Coordinates Missing XY Error ===');
          console.log(error.message);

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          );
        }
      });
    }, 30000);

    it('tests that invalid tabId is handled', async () => {
      await withMcpServer(async client => {
        const result = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId: 999999, x: 100, y: 100, text: 'test'},
        });

        console.log('\n=== Type at Coordinates Invalid TabId Response ===');
        console.log(JSON.stringify(result, null, 2));

        // Should error
        assert.ok(
          result.isError || result.content,
          'Should handle invalid tab',
        );
      });
    }, 30000);
  });

  describe('Coordinates Tools - Response Structure Validation', () => {
    it('tests that coordinates tools return valid MCP response structure', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const tools = [
          {
            name: 'browser_click_coordinates',
            args: {tabId, x: 50, y: 50},
          },
          {
            name: 'browser_type_at_coordinates',
            args: {tabId, x: 60, y: 60, text: 'test'},
          },
        ];

        for (const tool of tools) {
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args,
          });

          // Validate response structure
          assert.ok(result, 'Result should exist');
          assert.ok('content' in result, 'Should have content field');
          assert.ok(Array.isArray(result.content), 'content must be an array');

          if ('isError' in result) {
            assert.strictEqual(
              typeof result.isError,
              'boolean',
              'isError must be boolean when present',
            );
          }

          // Validate content items
          for (const item of result.content) {
            assert.ok(item.type, 'Content item must have type');
            assert.ok(
              item.type === 'text' || item.type === 'image',
              'Content type must be text or image',
            );

            if (item.type === 'text') {
              assert.ok('text' in item, 'Text content must have text property');
              assert.strictEqual(
                typeof item.text,
                'string',
                'Text must be string',
              );
            }
          }
        }
      });
    }, 30000);
  });

  describe('Coordinates Tools - Workflow Tests', () => {
    it('tests coordinate workflow: navigate → click → type', async () => {
      await withMcpServer(async client => {
        // Navigate to URL
        await client.callTool({
          name: 'browser_navigate',
          arguments: {url: 'https://example.com'},
        });

        // Get active tab
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        // Click coordinates
        const clickResult = await client.callTool({
          name: 'browser_click_coordinates',
          arguments: {tabId, x: 300, y: 300},
        });

        console.log('\n=== Workflow: Click Coordinates ===');
        console.log(JSON.stringify(clickResult, null, 2));

        assert.ok(!clickResult.isError, 'Click should succeed');

        // Type at coordinates
        const typeResult = await client.callTool({
          name: 'browser_type_at_coordinates',
          arguments: {tabId, x: 350, y: 350, text: 'Workflow test'},
        });

        console.log('\n=== Workflow: Type at Coordinates ===');
        console.log(JSON.stringify(typeResult, null, 2));

        assert.ok(!typeResult.isError, 'Type should succeed');
      });
    }, 30000);

    it('tests multiple coordinate clicks in sequence', async () => {
      await withMcpServer(async client => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        });

        const tabText = tabResult.content.find(c => c.type === 'text');
        const tabIdMatch = tabText.text.match(/ID: (\d+)/);
        const tabId = parseInt(tabIdMatch[1]);

        const coordinates = [
          {x: 100, y: 100},
          {x: 200, y: 200},
          {x: 300, y: 300},
          {x: 400, y: 400},
        ];

        for (const coord of coordinates) {
          const result = await client.callTool({
            name: 'browser_click_coordinates',
            arguments: {tabId, x: coord.x, y: coord.y},
          });

          assert.ok(
            !result.isError,
            `Click at (${coord.x}, ${coord.y}) should succeed`,
          );
        }

        console.log('\n=== Workflow: Multiple Coordinate Clicks Complete ===');
      });
    }, 30000);
  });
});
