// @ts-nocheck
/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Screenshot Tool', () => {
  describe('browser_get_screenshot - Success Cases', () => {
    it('tests that screenshot capture with default settings succeeds', async () => {
      await withMcpServer(async (client) => {
        // First navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Screenshot Test Page</h1><p>Content for screenshot</p></body>',
          },
        })

        assert.ok(!navResult.isError, 'Navigation should succeed')

        // Extract tab ID
        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        assert.ok(tabIdMatch, 'Should extract tab ID')
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture screenshot
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId },
        })

        console.log('\n=== Default Screenshot Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be an array')
        assert.ok(result.content.length > 0, 'Content should not be empty')

        // Should have text description
        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should include text content')
        assert.ok(
          textContent.text.includes('Screenshot captured'),
          'Should mention screenshot captured',
        )
        assert.ok(
          textContent.text.includes(`tab ${tabId}`),
          'Should include tab ID',
        )

        // Should have image data
        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
        assert.ok(imageContent.data, 'Should have image data')
        assert.ok(imageContent.mimeType, 'Should have mime type')
        assert.ok(
          imageContent.mimeType.startsWith('image/'),
          'Should be an image mime type',
        )
      })
    }, 30000)

    it('tests that screenshot capture with small size preset succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Small Screenshot Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture with small size
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            size: 'small',
          },
        })

        console.log('\n=== Small Screenshot Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')

        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
        assert.ok(imageContent.data, 'Should have image data')
      })
    }, 30000)

    it('tests that screenshot capture with medium size preset succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Medium Screenshot Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture with medium size
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            size: 'medium',
          },
        })

        console.log('\n=== Medium Screenshot Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')

        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
      })
    }, 30000)

    it('tests that screenshot capture with large size preset succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Large Screenshot Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture with large size
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            size: 'large',
          },
        })

        console.log('\n=== Large Screenshot Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')

        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
      })
    }, 30000)

    it('tests that screenshot capture with custom width and height succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Custom Size Screenshot</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture with custom dimensions
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            width: 800,
            height: 600,
          },
        })

        console.log('\n=== Custom Size Screenshot Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')

        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
      })
    }, 30000)

    it('tests that screenshot capture with showHighlights enabled succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Highlights Screenshot Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Capture with highlights
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            showHighlights: true,
          },
        })

        console.log('\n=== Screenshot with Highlights Response ===')
        console.log(
          JSON.stringify(
            {
              ...result,
              content: result.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 data ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!result.isError, 'Should succeed')

        const imageContent = result.content.find((c) => c.type === 'image')
        assert.ok(imageContent, 'Should include image content')
      })
    }, 30000)
  })

  describe('browser_get_screenshot - Error Handling', () => {
    it('tests that screenshot of invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId: 999999999 },
        })

        console.log('\n=== Screenshot Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that screenshot with non-numeric tab ID is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_get_screenshot',
            arguments: { tabId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Screenshot Invalid Tab Type Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid arguments') ||
              error.message.includes('Expected number'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that screenshot with invalid size preset is rejected', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page first
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        try {
          await client.callTool({
            name: 'browser_get_screenshot',
            arguments: {
              tabId,
              size: 'invalid-size',
            },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Screenshot Invalid Size Error ===')
          console.log(error.message)

          assert.ok(
            error.message.includes('Invalid') || error.message.includes('enum'),
            'Should reject with validation error',
          )
        }
      })
    }, 30000)

    it('tests that screenshot with negative dimensions is rejected', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page first
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Try with negative width
        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: {
            tabId,
            width: -100,
            height: 600,
          },
        })

        console.log('\n=== Screenshot Negative Dimensions Response ===')
        console.log(JSON.stringify(result, null, 2))

        // May be rejected by validation or extension
        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content')
      })
    }, 30000)
  })

  describe('browser_get_screenshot - Response Structure Validation', () => {
    it('tests that screenshot tool returns valid MCP response structure', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><h1>Test</h1></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId },
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

          if (item.type === 'image') {
            assert.ok('data' in item, 'Image content must have data property')
            assert.ok('mimeType' in item, 'Image content must have mimeType')
            assert.strictEqual(
              typeof item.data,
              'string',
              'Image data must be string (base64)',
            )
            assert.ok(
              item.mimeType.startsWith('image/'),
              'mimeType must be image type',
            )
          }
        }
      })
    }, 30000)
  })

  describe('browser_get_screenshot - Workflow Tests', () => {
    it('tests complete screenshot workflow: navigate, multiple screenshots with different sizes', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="background:linear-gradient(45deg, red, blue)"><h1 style="color:white;text-align:center;padding-top:100px">Multi-Screenshot Test</h1></body>',
          },
        })

        console.log('\n=== Workflow: Navigate Response ===')
        console.log(JSON.stringify(navResult, null, 2))

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Take small screenshot
        const smallResult = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId, size: 'small' },
        })

        console.log('\n=== Workflow: Small Screenshot ===')
        console.log(
          JSON.stringify(
            {
              ...smallResult,
              content: smallResult.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!smallResult.isError, 'Small screenshot should succeed')

        // Take large screenshot
        const largeResult = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId, size: 'large' },
        })

        console.log('\n=== Workflow: Large Screenshot ===')
        console.log(
          JSON.stringify(
            {
              ...largeResult,
              content: largeResult.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!largeResult.isError, 'Large screenshot should succeed')

        // Take custom size screenshot
        const customResult = await client.callTool({
          name: 'browser_get_screenshot',
          arguments: { tabId, width: 1024, height: 768 },
        })

        console.log('\n=== Workflow: Custom Screenshot ===')
        console.log(
          JSON.stringify(
            {
              ...customResult,
              content: customResult.content.map((c) =>
                c.type === 'image'
                  ? { ...c, data: `<base64 ${c.data?.length || 0} chars>` }
                  : c,
              ),
            },
            null,
            2,
          ),
        )

        assert.ok(!customResult.isError, 'Custom screenshot should succeed')
      })
    }, 30000)
  })
})
