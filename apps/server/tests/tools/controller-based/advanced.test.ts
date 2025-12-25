// @ts-nocheck
/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Advanced Tools', () => {
  describe('browser_execute_javascript - Success Cases', () => {
    it('tests that executing simple JavaScript succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: '1 + 1' },
        })

        console.log('\n=== Execute Simple JavaScript Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('JavaScript executed'),
          'Should confirm execution',
        )
        assert.ok(textContent.text.includes('Result:'), 'Should include result')
      })
    }, 30000)

    it('tests that executing JavaScript returning string succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: '"Hello World"' },
        })

        console.log('\n=== Execute JS Returning String Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing JavaScript returning object succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: {
            tabId,
            code: '({name: "test", value: 42})',
          },
        })

        console.log('\n=== Execute JS Returning Object Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing JavaScript returning array succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: '[1, 2, 3, 4, 5]' },
        })

        console.log('\n=== Execute JS Returning Array Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing DOM manipulation JavaScript succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: {
            tabId,
            code: 'document.title',
          },
        })

        console.log('\n=== Execute DOM Manipulation JS Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing JavaScript returning undefined succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: 'undefined' },
        })

        console.log('\n=== Execute JS Returning Undefined Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing JavaScript returning null succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: 'null' },
        })

        console.log('\n=== Execute JS Returning Null Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that executing multiline JavaScript succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const code = `
            const x = 10;
            const y = 20;
            x + y;
          `

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code },
        })

        console.log('\n=== Execute Multiline JS Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)
  })

  describe('browser_execute_javascript - Error Handling', () => {
    it('tests that missing code is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_execute_javascript',
            arguments: { tabId: 1 },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Execute JS Missing Code Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that missing tabId is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_execute_javascript',
            arguments: { code: '1 + 1' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Execute JS Missing TabId Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that invalid JavaScript syntax is handled', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId, code: 'invalid javascript syntax {{{' },
        })

        console.log('\n=== Execute Invalid JS Syntax Response ===')
        console.log(JSON.stringify(result, null, 2))

        // Should either error or return error in result
        assert.ok(result, 'Should return a result')
      })
    }, 30000)

    it('tests that invalid tabId is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: { tabId: 999999, code: '1 + 1' },
        })

        console.log('\n=== Execute JS Invalid TabId Response ===')
        console.log(JSON.stringify(result, null, 2))

        // Should error
        assert.ok(result.isError || result.content, 'Should handle invalid tab')
      })
    }, 30000)
  })

  describe('browser_send_keys - Success Cases', () => {
    it('tests that sending Enter key succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Enter' },
        })

        console.log('\n=== Send Enter Key Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
      })
    }, 30000)

    it('tests that sending Escape key succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Escape' },
        })

        console.log('\n=== Send Escape Key Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that sending Tab key succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Tab' },
        })

        console.log('\n=== Send Tab Key Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that sending arrow keys succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

        for (const key of arrowKeys) {
          const result = await client.callTool({
            name: 'browser_send_keys',
            arguments: { tabId, key },
          })

          assert.ok(!result.isError, `Sending ${key} should succeed`)
        }

        console.log('\n=== Send Arrow Keys Complete ===')
      })
    }, 30000)

    it('tests that sending navigation keys succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const navKeys = ['Home', 'End', 'PageUp', 'PageDown']

        for (const key of navKeys) {
          const result = await client.callTool({
            name: 'browser_send_keys',
            arguments: { tabId, key },
          })

          assert.ok(!result.isError, `Sending ${key} should succeed`)
        }

        console.log('\n=== Send Navigation Keys Complete ===')
      })
    }, 30000)

    it('tests that sending Delete key succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Delete' },
        })

        console.log('\n=== Send Delete Key Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that sending Backspace key succeeds', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Backspace' },
        })

        console.log('\n=== Send Backspace Key Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)
  })

  describe('browser_send_keys - Error Handling', () => {
    it('tests that missing key is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_send_keys',
            arguments: { tabId: 1 },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Send Keys Missing Key Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that invalid key is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_send_keys',
            arguments: { tabId: 1, key: 'InvalidKey' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Send Keys Invalid Key Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Invalid enum value'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that missing tabId is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_send_keys',
            arguments: { key: 'Enter' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Send Keys Missing TabId Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Required'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that invalid tabId is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId: 999999, key: 'Enter' },
        })

        console.log('\n=== Send Keys Invalid TabId Response ===')
        console.log(JSON.stringify(result, null, 2))

        // Should error
        assert.ok(result.isError || result.content, 'Should handle invalid tab')
      })
    }, 30000)
  })

  describe('browser_check_availability - Success Cases', () => {
    it('tests that checking BrowserOS availability succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_check_availability',
          arguments: {},
        })

        console.log('\n=== Check Availability Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('BrowserOS APIs available'),
          'Should indicate availability status',
        )
      })
    }, 30000)
  })

  describe('Advanced Tools - Response Structure Validation', () => {
    it('tests that advanced tools return valid MCP response structure', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const tools = [
          {
            name: 'browser_execute_javascript',
            args: { tabId, code: '1 + 1' },
          },
          { name: 'browser_send_keys', args: { tabId, key: 'Escape' } },
          { name: 'browser_check_availability', args: {} },
        ]

        for (const tool of tools) {
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args,
          })

          // Validate response structure
          assert.ok(result, 'Result should exist')
          assert.ok('content' in result, 'Should have content field')
          assert.ok(Array.isArray(result.content), 'content must be an array')

          if ('isError' in result) {
            assert.strictEqual(
              typeof result.isError,
              'boolean',
              'isError must be boolean when present',
            )
          }

          // Validate content items
          for (const item of result.content) {
            assert.ok(item.type, 'Content item must have type')
            assert.ok(
              item.type === 'text' || item.type === 'image',
              'Content type must be text or image',
            )

            if (item.type === 'text') {
              assert.ok('text' in item, 'Text content must have text property')
              assert.strictEqual(
                typeof item.text,
                'string',
                'Text must be string',
              )
            }
          }
        }
      })
    }, 30000)
  })

  describe('Advanced Tools - Workflow Tests', () => {
    it('tests workflow: check availability → execute JavaScript', async () => {
      await withMcpServer(async (client) => {
        // Check availability
        const availResult = await client.callTool({
          name: 'browser_check_availability',
          arguments: {},
        })

        console.log('\n=== Workflow: Check Availability ===')
        console.log(JSON.stringify(availResult, null, 2))

        assert.ok(!availResult.isError, 'Availability check should succeed')

        // Execute JavaScript
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const jsResult = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: {
            tabId,
            code: 'window.location.href',
          },
        })

        console.log('\n=== Workflow: Execute JavaScript ===')
        console.log(JSON.stringify(jsResult, null, 2))

        assert.ok(!jsResult.isError, 'JavaScript execution should succeed')
      })
    }, 30000)

    it('tests workflow: execute JS → send keys → execute JS again', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Execute initial JS
        const js1Result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: {
            tabId,
            code: 'document.title',
          },
        })

        assert.ok(!js1Result.isError, 'First JS execution should succeed')

        // Send key
        const keyResult = await client.callTool({
          name: 'browser_send_keys',
          arguments: { tabId, key: 'Escape' },
        })

        assert.ok(!keyResult.isError, 'Send key should succeed')

        // Execute JS again
        const js2Result = await client.callTool({
          name: 'browser_execute_javascript',
          arguments: {
            tabId,
            code: 'document.readyState',
          },
        })

        assert.ok(!js2Result.isError, 'Second JS execution should succeed')

        console.log('\n=== Workflow: JS → Keys → JS Complete ===')
      })
    }, 30000)

    it('tests workflow: multiple key sends in sequence', async () => {
      await withMcpServer(async (client) => {
        const tabResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        const tabText = tabResult.content.find((c) => c.type === 'text')
        const tabIdMatch = tabText.text.match(/ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const keys = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']

        for (const key of keys) {
          const result = await client.callTool({
            name: 'browser_send_keys',
            arguments: { tabId, key },
          })

          assert.ok(!result.isError, `Sending ${key} should succeed`)
        }

        console.log('\n=== Workflow: Multiple Key Sequence Complete ===')
      })
    }, 30000)
  })
})
