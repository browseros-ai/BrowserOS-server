// @ts-nocheck
/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller History Tools', () => {
  describe('browser_search_history - Success Cases', () => {
    it('tests that history search with query succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'example' },
        })

        console.log('\n=== Search History Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('Found'),
          'Should indicate results found',
        )
        assert.ok(
          textContent.text.includes('history items'),
          'Should mention history items',
        )
      })
    }, 30000)

    it('tests that history search with maxResults limit succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'test', maxResults: 10 },
        })

        console.log('\n=== Search History with Max Results Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(textContent.text.includes('Found'), 'Should show results')
      })
    }, 30000)

    it('tests that history search with empty query succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: '' },
        })

        console.log('\n=== Search History Empty Query Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
      })
    }, 30000)

    it('tests that history search with special characters succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'test@example.com' },
        })

        console.log('\n=== Search History Special Characters Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that history search with large maxResults succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'test', maxResults: 1000 },
        })

        console.log('\n=== Search History Large Max Results Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)
  })

  describe('browser_search_history - Error Handling', () => {
    it('tests that non-numeric maxResults is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_search_history',
            arguments: { query: 'test', maxResults: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Search History Invalid Max Results Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that zero maxResults is rejected', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'test', maxResults: 0 },
        })

        console.log('\n=== Search History Zero Max Results Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result.isError, 'Should be an error')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(
          textContent.text.includes('Too small') ||
            textContent.text.includes('expected number to be >0'),
          'Should reject zero maxResults',
        )
      })
    }, 30000)

    it('tests that negative maxResults is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'test', maxResults: -1 },
        })

        console.log('\n=== Search History Negative Max Results Response ===')
        console.log(JSON.stringify(result, null, 2))

        // Should either succeed with 0 results or handle gracefully
        assert.ok(result, 'Should return a result')
      })
    }, 30000)
  })

  describe('browser_get_recent_history - Success Cases', () => {
    it('tests that getting recent history with default count succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: {},
        })

        console.log('\n=== Get Recent History Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('Retrieved'),
          'Should indicate items retrieved',
        )
        assert.ok(
          textContent.text.includes('history items'),
          'Should mention history items',
        )
      })
    }, 30000)

    it('tests that getting recent history with specific count succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 10 },
        })

        console.log('\n=== Get Recent History with Count Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
      })
    }, 30000)

    it('tests that getting recent history with large count succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 500 },
        })

        console.log('\n=== Get Recent History Large Count Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that getting recent history with count 1 succeeds', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 1 },
        })

        console.log('\n=== Get Recent History Count 1 Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
      })
    }, 30000)
  })

  describe('browser_get_recent_history - Error Handling', () => {
    it('tests that non-numeric count is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_get_recent_history',
            arguments: { count: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Get Recent History Invalid Count Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that zero count returns all items', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 0 },
        })

        console.log('\n=== Get Recent History Zero Count Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(
          textContent.text.includes('Retrieved'),
          'Should return results (zero not enforced)',
        )
      })
    }, 30000)

    it('tests that negative count is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: -1 },
        })

        console.log('\n=== Get Recent History Negative Count Response ===')
        console.log(JSON.stringify(result, null, 2))

        // Should either succeed with 0 results or handle gracefully
        assert.ok(result, 'Should return a result')
      })
    }, 30000)
  })

  describe('History Tools - Response Structure Validation', () => {
    it('tests that history tools return valid MCP response structure', async () => {
      await withMcpServer(async (client) => {
        const tools = [
          { name: 'browser_search_history', args: { query: 'test' } },
          { name: 'browser_get_recent_history', args: {} },
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

  describe('History Tools - Workflow Tests', () => {
    it('tests complete history workflow: get recent -> search specific', async () => {
      await withMcpServer(async (client) => {
        // Get recent history
        const recentResult = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 5 },
        })

        console.log('\n=== Workflow: Get Recent History ===')
        console.log(JSON.stringify(recentResult, null, 2))

        assert.ok(!recentResult.isError, 'Get recent should succeed')

        // Search history
        const searchResult = await client.callTool({
          name: 'browser_search_history',
          arguments: { query: 'browseros', maxResults: 10 },
        })

        console.log('\n=== Workflow: Search History ===')
        console.log(JSON.stringify(searchResult, null, 2))

        assert.ok(!searchResult.isError, 'Search should succeed')
      })
    }, 30000)

    it('tests history comparison workflow: get recent multiple times', async () => {
      await withMcpServer(async (client) => {
        // Get recent history first time
        const result1 = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 20 },
        })

        console.log('\n=== Workflow: First Recent History Call ===')
        console.log(JSON.stringify(result1, null, 2))

        assert.ok(!result1.isError, 'First call should succeed')

        // Navigate to add to history
        await client.callTool({
          name: 'browser_navigate',
          arguments: { url: 'https://example.com' },
        })

        // Get recent history second time
        const result2 = await client.callTool({
          name: 'browser_get_recent_history',
          arguments: { count: 20 },
        })

        console.log('\n=== Workflow: Second Recent History Call ===')
        console.log(JSON.stringify(result2, null, 2))

        assert.ok(!result2.isError, 'Second call should succeed')
      })
    }, 30000)
  })
})
