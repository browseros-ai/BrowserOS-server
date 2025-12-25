// @ts-nocheck
/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Tab Management Tools', () => {
  describe('browser_get_active_tab - Success Cases', () => {
    it('tests that active tab information is successfully retrieved', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        console.log('\n=== Get Active Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be an array')
        assert.ok(result.content.length > 0, 'Content should not be empty')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should include text content')
        assert.ok(
          textContent.text.includes('Active Tab:'),
          'Should include active tab title',
        )
        assert.ok(textContent.text.includes('URL:'), 'Should include URL')
        assert.ok(textContent.text.includes('Tab ID:'), 'Should include tab ID')
        assert.ok(
          textContent.text.includes('Window ID:'),
          'Should include window ID',
        )
      })
    }, 30000)
  })

  describe('browser_list_tabs - Success Cases', () => {
    it('tests that all open tabs are successfully listed', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_list_tabs',
          arguments: {},
        })

        console.log('\n=== List Tabs Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')
        assert.ok(result.content.length > 0, 'Should have content')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('Found') &&
            textContent.text.includes('open tabs'),
          'Should include tab count',
        )
      })
    }, 30000)

    it('tests that structured content includes tabs and count', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_list_tabs',
          arguments: {},
        })

        console.log('\n=== List Tabs Structured Content ===')
        console.log(JSON.stringify(result.structuredContent, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(result.structuredContent, 'Should have structuredContent')
        assert.ok(
          Array.isArray(result.structuredContent.tabs),
          'structuredContent.tabs should be an array',
        )
        assert.ok(
          typeof result.structuredContent.count === 'number',
          'structuredContent.count should be a number',
        )
        assert.strictEqual(
          result.structuredContent.tabs.length,
          result.structuredContent.count,
          'tabs array length should match count',
        )

        if (result.structuredContent.tabs.length > 0) {
          const tab = result.structuredContent.tabs[0]
          assert.ok('id' in tab, 'Tab should have id')
          assert.ok('url' in tab, 'Tab should have url')
          assert.ok('title' in tab, 'Tab should have title')
          assert.ok('windowId' in tab, 'Tab should have windowId')
          assert.ok('active' in tab, 'Tab should have active')
          assert.ok('index' in tab, 'Tab should have index')
        }
      })
    }, 30000)
  })

  describe('browser_open_tab - Success Cases', () => {
    it('tests that a new tab with URL is successfully opened', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_open_tab',
          arguments: {
            url: 'https://example.com',
            active: true,
          },
        })

        console.log('\n=== Open Tab with URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')
        assert.ok(result.content.length > 0, 'Should have content')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('Opened new tab'),
          'Should confirm tab opened',
        )
        assert.ok(textContent.text.includes('URL:'), 'Should include URL')
        assert.ok(textContent.text.includes('Tab ID:'), 'Should include tab ID')
      })
    }, 30000)

    it('tests that a new tab without URL is successfully opened', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_open_tab',
          arguments: {},
        })

        console.log('\n=== Open Tab without URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')
        assert.ok(result.content.length > 0, 'Should have content')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('Opened new tab'),
          'Should confirm tab opened',
        )
      })
    }, 30000)

    it('tests that a new tab in background is successfully opened', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_open_tab',
          arguments: {
            url: 'data:text/html,<h1>Background Tab</h1>',
            active: false,
          },
        })

        console.log('\n=== Open Background Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')
      })
    }, 30000)
  })

  describe('browser_close_tab - Success and Error Cases', () => {
    it('tests that a tab is successfully closed by ID', async () => {
      await withMcpServer(async (client) => {
        // First open a tab to close
        const openResult = await client.callTool({
          name: 'browser_open_tab',
          arguments: {
            url: 'data:text/html,<h1>Tab to Close</h1>',
            active: false,
          },
        })

        assert.ok(!openResult.isError, 'Open should succeed')

        // Extract tab ID from response
        const openText = openResult.content.find((c) => c.type === 'text')
        const tabIdMatch = openText.text.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch[1], 10)

        // Now close the tab
        const closeResult = await client.callTool({
          name: 'browser_close_tab',
          arguments: { tabId },
        })

        console.log('\n=== Close Tab Response ===')
        console.log(JSON.stringify(closeResult, null, 2))

        assert.ok(!closeResult.isError, 'Should succeed')
        assert.ok(Array.isArray(closeResult.content), 'Content should be array')

        const closeText = closeResult.content.find((c) => c.type === 'text')
        assert.ok(closeText, 'Should have text content')
        assert.ok(
          closeText.text.includes(`Closed tab ${tabId}`),
          'Should confirm tab closed',
        )
      })
    }, 30000)

    it('tests that invalid tab ID is handled gracefully', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_close_tab',
          arguments: { tabId: 999999999 },
        })

        console.log('\n=== Close Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        // May error or succeed depending on extension behavior
        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(
            textContent,
            'Error should include text content explaining the issue',
          )
        }
      })
    }, 30000)

    it('tests that non-numeric tab ID is rejected with validation error', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_close_tab',
            arguments: { tabId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Close Tab with Invalid ID Type Error ===')
          console.log(error.message)

          // Validation error should be thrown by MCP SDK
          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)
  })

  describe('browser_switch_tab - Success and Error Cases', () => {
    it('tests that switching to a tab by ID succeeds', async () => {
      await withMcpServer(async (client) => {
        // First open a tab to switch to
        const openResult = await client.callTool({
          name: 'browser_open_tab',
          arguments: {
            url: 'data:text/html,<h1>Target Tab</h1>',
            active: false,
          },
        })

        assert.ok(!openResult.isError, 'Open should succeed')

        // Extract tab ID
        const openText = openResult.content.find((c) => c.type === 'text')
        const tabIdMatch = openText.text.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch[1], 10)

        // Now switch to the tab
        const switchResult = await client.callTool({
          name: 'browser_switch_tab',
          arguments: { tabId },
        })

        console.log('\n=== Switch Tab Response ===')
        console.log(JSON.stringify(switchResult, null, 2))

        assert.ok(!switchResult.isError, 'Should succeed')
        assert.ok(
          Array.isArray(switchResult.content),
          'Content should be array',
        )

        const switchText = switchResult.content.find((c) => c.type === 'text')
        assert.ok(switchText, 'Should have text content')
        assert.ok(
          switchText.text.includes('Switched to tab:'),
          'Should confirm tab switch',
        )
        assert.ok(switchText.text.includes('URL:'), 'Should include URL')
      })
    }, 30000)

    it('tests that switching to invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_switch_tab',
          arguments: { tabId: 999999999 },
        })

        console.log('\n=== Switch to Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)
  })

  describe('browser_get_load_status - Success and Error Cases', () => {
    it('tests that load status of active tab is successfully checked', async () => {
      await withMcpServer(async (client) => {
        // Get active tab first
        const activeResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        assert.ok(!activeResult.isError, 'Get active tab should succeed')

        // Extract tab ID
        const activeText = activeResult.content.find((c) => c.type === 'text')
        const tabIdMatch = activeText.text.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch[1], 10)

        // Check load status
        const statusResult = await client.callTool({
          name: 'browser_get_load_status',
          arguments: { tabId },
        })

        console.log('\n=== Get Load Status Response ===')
        console.log(JSON.stringify(statusResult, null, 2))

        assert.ok(!statusResult.isError, 'Should succeed')
        assert.ok(
          Array.isArray(statusResult.content),
          'Content should be array',
        )

        const statusText = statusResult.content.find((c) => c.type === 'text')
        assert.ok(statusText, 'Should have text content')
        assert.ok(
          statusText.text.includes('load status:'),
          'Should include status header',
        )
        assert.ok(
          statusText.text.includes('Resources Loading:'),
          'Should include resources loading status',
        )
        assert.ok(
          statusText.text.includes('DOM Content Loaded:'),
          'Should include DOM loaded status',
        )
        assert.ok(
          statusText.text.includes('Page Complete:'),
          'Should include page complete status',
        )
      })
    }, 30000)

    it('tests that checking load status of invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_load_status',
          arguments: { tabId: 999999999 },
        })

        console.log('\n=== Get Load Status Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)
  })

  describe('Tab Management - Response Structure Validation', () => {
    it('tests that all tab tools return valid MCP response structure', async () => {
      await withMcpServer(async (client) => {
        const tools = [
          { name: 'browser_get_active_tab', args: {} },
          { name: 'browser_list_tabs', args: {} },
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

          // isError is only present when there's an error (undefined on success)
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

  describe('Tab Management - Workflow Tests', () => {
    it('tests complete tab lifecycle: open -> switch -> close', async () => {
      await withMcpServer(async (client) => {
        // Open a new tab
        const openResult = await client.callTool({
          name: 'browser_open_tab',
          arguments: {
            url: 'data:text/html,<h1>Lifecycle Test</h1>',
            active: false,
          },
        })

        console.log('\n=== Lifecycle: Open Response ===')
        console.log(JSON.stringify(openResult, null, 2))

        assert.ok(!openResult.isError, 'Open should succeed')

        // Extract tab ID
        const openText = openResult.content.find((c) => c.type === 'text')
        const tabIdMatch = openText.text.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch[1], 10)

        // Switch to the tab
        const switchResult = await client.callTool({
          name: 'browser_switch_tab',
          arguments: { tabId },
        })

        console.log('\n=== Lifecycle: Switch Response ===')
        console.log(JSON.stringify(switchResult, null, 2))

        assert.ok(!switchResult.isError, 'Switch should succeed')

        // Verify it's now active
        const activeResult = await client.callTool({
          name: 'browser_get_active_tab',
          arguments: {},
        })

        console.log('\n=== Lifecycle: Verify Active Response ===')
        console.log(JSON.stringify(activeResult, null, 2))

        assert.ok(!activeResult.isError, 'Get active should succeed')
        const activeText = activeResult.content.find((c) => c.type === 'text')
        assert.ok(
          activeText.text.includes(`Tab ID: ${tabId}`),
          'Should be the active tab',
        )

        // Close the tab
        const closeResult = await client.callTool({
          name: 'browser_close_tab',
          arguments: { tabId },
        })

        console.log('\n=== Lifecycle: Close Response ===')
        console.log(JSON.stringify(closeResult, null, 2))

        assert.ok(!closeResult.isError, 'Close should succeed')
      })
    }, 30000)
  })
})
