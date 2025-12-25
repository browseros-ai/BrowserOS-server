/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { type McpContentItem, withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Navigation Tools', () => {
  describe('browser_navigate - Success Cases', () => {
    it('tests that navigation to HTTPS URL succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'https://example.com',
          },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== HTTPS URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Navigation should succeed')
        assert.ok(Array.isArray(content), 'Content should be an array')
        assert.ok(content.length > 0, 'Content should not be empty')

        const textContent = content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should include text content')
        assert.ok(
          textContent.text?.includes('Navigating to'),
          'Should include navigation message',
        )
        assert.ok(
          textContent.text?.includes('Tab ID:'),
          'Should include tab ID',
        )
      })
    }, 30000)

    it('tests that navigation to data URL succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<h1>Test Page</h1>',
          },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== Data URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Navigation to data URL should succeed')
        assert.ok(Array.isArray(content), 'Content should be array')
        assert.ok(content.length > 0, 'Should have content')

        const textContent = content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text?.includes('data:text/html'),
          'Should reference data URL',
        )
      })
    }, 30000)

    it('tests that navigation to HTTP URL succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'http://example.com',
          },
        })
        const content = result.content as McpContentItem[]

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(
          Array.isArray(content) && content.length > 0,
          'Should have content',
        )
      })
    }, 30000)
  })

  describe('browser_navigate - Error Handling', () => {
    it('tests that invalid URL is handled gracefully', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'not-a-valid-url',
          },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== Invalid URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(content), 'Should have content array')

        if (result.isError) {
          const textContent = content.find((c) => c.type === 'text')
          assert.ok(
            textContent,
            'Error should include text content explaining the issue',
          )
        }
      })
    }, 30000)

    it('tests that meaningful response structure is provided on any error', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: '',
          },
        })
        const content = result.content as McpContentItem[]

        console.log('\n=== Empty URL Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return result object')
        assert.ok(
          typeof result.isError === 'boolean',
          'isError should be boolean',
        )
        assert.ok(Array.isArray(content), 'content should be an array')

        if (result.isError) {
          assert.ok(content.length > 0, 'Error response should have content')
          const textContent = content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Should have text explaining error')
          assert.ok(
            textContent.text && textContent.text.length > 0,
            'Error message should not be empty',
          )
        }
      })
    }, 30000)
  })

  describe('browser_navigate - Response Structure Validation', () => {
    it('tests that valid MCP response structure is always returned', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'https://example.com',
          },
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
      })
    }, 30000)
  })
})
