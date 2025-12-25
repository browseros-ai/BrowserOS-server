/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { type McpContentItem, withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Scrolling Tools', () => {
  describe('browser_scroll_down - Success Cases', () => {
    it('tests that scrolling down in active tab succeeds', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:5000px"><h1>Long Page</h1><p>Scroll test</p></body>',
          },
        })
        const navContent = navResult.content as McpContentItem[]

        assert.ok(!navResult.isError, 'Navigation should succeed')

        const navText = navContent.find((c) => c.type === 'text')
        const tabIdMatch = navText?.text?.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch?.[1], 10)

        const scrollResult = await client.callTool({
          name: 'browser_scroll_down',
          arguments: { tabId },
        })
        const scrollContent = scrollResult.content as McpContentItem[]

        console.log('\n=== Scroll Down Response ===')
        console.log(JSON.stringify(scrollResult, null, 2))

        assert.ok(!scrollResult.isError, 'Should succeed')
        assert.ok(Array.isArray(scrollContent), 'Content should be array')
        assert.ok(scrollContent.length > 0, 'Should have content')

        const textContent = scrollContent.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text?.includes('Scrolled down'),
          'Should confirm scroll down',
        )
        assert.ok(
          textContent.text?.includes(`tab ${tabId}`),
          'Should include tab ID',
        )
      })
    }, 30000)
  })

  describe('browser_scroll_up - Success Cases', () => {
    it('tests that scrolling up in active tab succeeds', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:5000px"><h1>Long Page</h1></body>',
          },
        })
        const navContent = navResult.content as McpContentItem[]

        assert.ok(!navResult.isError, 'Navigation should succeed')

        const navText = navContent.find((c) => c.type === 'text')
        const tabIdMatch = navText?.text?.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch?.[1], 10)

        await client.callTool({
          name: 'browser_scroll_down',
          arguments: { tabId },
        })

        const scrollResult = await client.callTool({
          name: 'browser_scroll_up',
          arguments: { tabId },
        })
        const scrollContent = scrollResult.content as McpContentItem[]

        console.log('\n=== Scroll Up Response ===')
        console.log(JSON.stringify(scrollResult, null, 2))

        assert.ok(!scrollResult.isError, 'Should succeed')
        assert.ok(Array.isArray(scrollContent), 'Content should be array')

        const textContent = scrollContent.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text?.includes('Scrolled up'),
          'Should confirm scroll up',
        )
      })
    }, 30000)
  })

  describe('Scrolling - Error Handling', () => {
    it('tests that scrolling down with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_scroll_down',
          arguments: { tabId: 999999999 },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== Scroll Down Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(content), 'Should have content array')

        if (result.isError) {
          const textContent = content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that scrolling up with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_scroll_up',
          arguments: { tabId: 999999999 },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== Scroll Up Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(content), 'Should have content array')

        if (result.isError) {
          const textContent = content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that scroll_down with non-numeric tab ID is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_scroll_down',
            arguments: { tabId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error: any) {
          console.log('\n=== Scroll Down Invalid Type Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that scroll_up with non-numeric tab ID is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_scroll_up',
            arguments: { tabId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error: any) {
          console.log('\n=== Scroll Up Invalid Type Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)
  })

  describe('Scrolling - Response Structure Validation', () => {
    it('tests that scrolling tools return valid MCP response structure', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:3000px"><h1>Test</h1></body>',
          },
        })
        const navContent = navResult.content as McpContentItem[]

        const navText = navContent.find((c) => c.type === 'text')
        const tabIdMatch = navText?.text?.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch?.[1] ?? '0', 10)

        const tools = [
          { name: 'browser_scroll_down', args: { tabId } },
          { name: 'browser_scroll_up', args: { tabId } },
        ]

        for (const tool of tools) {
          const result = await client.callTool({
            name: tool.name,
            arguments: tool.args,
          })
          const content = result.content as McpContentItem[]

          assert.ok(result, 'Result should exist')
          assert.ok('content' in result, 'Should have content field')
          assert.ok(Array.isArray(content), 'content must be an array')

          if ('isError' in result) {
            assert.strictEqual(
              typeof result.isError,
              'boolean',
              'isError must be boolean when present',
            )
          }

          for (const item of content) {
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

  describe('Scrolling - Workflow Tests', () => {
    it('tests complete scrolling workflow: navigate, scroll down multiple times, scroll up', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:8000px"><h1 style="position:absolute;top:0">Top</h1><h1 style="position:absolute;bottom:0">Bottom</h1></body>',
          },
        })
        const navContent = navResult.content as McpContentItem[]

        console.log('\n=== Workflow: Navigate Response ===')
        console.log(JSON.stringify(navResult, null, 2))

        assert.ok(!navResult.isError, 'Navigation should succeed')

        const navText = navContent.find((c) => c.type === 'text')
        const tabIdMatch = navText?.text?.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch?.[1] ?? '0', 10)

        const scroll1 = await client.callTool({
          name: 'browser_scroll_down',
          arguments: { tabId },
        })

        console.log('\n=== Workflow: First Scroll Down ===')
        console.log(JSON.stringify(scroll1, null, 2))

        assert.ok(!scroll1.isError, 'First scroll down should succeed')

        const scroll2 = await client.callTool({
          name: 'browser_scroll_down',
          arguments: { tabId },
        })

        console.log('\n=== Workflow: Second Scroll Down ===')
        console.log(JSON.stringify(scroll2, null, 2))

        assert.ok(!scroll2.isError, 'Second scroll down should succeed')

        const scroll3 = await client.callTool({
          name: 'browser_scroll_up',
          arguments: { tabId },
        })

        console.log('\n=== Workflow: Scroll Up ===')
        console.log(JSON.stringify(scroll3, null, 2))

        assert.ok(!scroll3.isError, 'Scroll up should succeed')
      })
    }, 30000)
  })
})
