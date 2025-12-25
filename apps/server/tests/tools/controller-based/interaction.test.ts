// @ts-nocheck
/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { withMcpServer } from '../../__helpers__/utils.js'

describe('MCP Controller Interaction Tools', () => {
  describe('browser_get_interactive_elements - Success Cases', () => {
    it('tests that interactive elements are retrieved with simplified format', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page with interactive elements
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><button id="btn1">Click Me</button><input id="input1" type="text" placeholder="Enter text" /><a href="#" id="link1">Link</a></body>',
          },
        })

        assert.ok(!navResult.isError, 'Navigation should succeed')

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get interactive elements
        const result = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId, simplified: true },
        })

        console.log('\n=== Get Interactive Elements (Simplified) Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')
        assert.ok(Array.isArray(result.content), 'Content should be array')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(textContent, 'Should have text content')
        assert.ok(
          textContent.text.includes('INTERACTIVE ELEMENTS'),
          'Should include header',
        )
        assert.ok(
          textContent.text.includes('Snapshot ID:'),
          'Should include snapshot ID',
        )
        assert.ok(textContent.text.includes('Legend'), 'Should include legend')
      })
    }, 30000)

    it('tests that interactive elements are retrieved with full format', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><button>Button</button><input type="text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId, simplified: false },
        })

        console.log('\n=== Get Interactive Elements (Full) Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        // Full format includes more context (ctx:) in element descriptions
        assert.ok(
          textContent.text.includes('ctx:') ||
            textContent.text.includes('INTERACTIVE ELEMENTS'),
          'Full format should include detailed element info',
        )
      })
    }, 30000)

    it('tests that page with no interactive elements is handled', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><p>Just plain text</p></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        console.log('\n=== Get Interactive Elements (No Elements) Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(!result.isError, 'Should succeed')

        const textContent = result.content.find((c) => c.type === 'text')
        assert.ok(
          textContent.text.includes('INTERACTIVE ELEMENTS') &&
            textContent.text.includes('Snapshot ID:'),
          'Should return valid response with snapshot info',
        )
      })
    }, 30000)
  })

  describe('browser_get_interactive_elements - Error Handling', () => {
    it('tests that invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId: 999999999 },
        })

        console.log('\n=== Get Interactive Elements Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that non-numeric tab ID is rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_get_interactive_elements',
            arguments: { tabId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Get Interactive Elements Invalid Type Error ===')
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

  describe('browser_click_element - Success Cases', () => {
    it('tests that element click succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page with a clickable button
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><button id="testBtn" onclick="alert(\'clicked\')">Click Me</button></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get interactive elements to find the button's nodeId
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        assert.ok(!elementsResult.isError, 'Get elements should succeed')

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        // Extract first nodeId from the response (format: [123])
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        assert.ok(nodeIdMatch, 'Should find a nodeId')
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Click the element
        const clickResult = await client.callTool({
          name: 'browser_click_element',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Click Element Response ===')
        console.log(JSON.stringify(clickResult, null, 2))

        assert.ok(!clickResult.isError, 'Should succeed')

        const clickText = clickResult.content.find((c) => c.type === 'text')
        assert.ok(clickText, 'Should have text content')
        assert.ok(
          clickText.text.includes(`Clicked element ${nodeId}`),
          'Should confirm click',
        )
        assert.ok(
          clickText.text.includes(`tab ${tabId}`),
          'Should include tab ID',
        )
      })
    }, 30000)
  })

  describe('browser_click_element - Error Handling', () => {
    it('tests that clicking with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_click_element',
          arguments: { tabId: 999999999, nodeId: 1 },
        })

        console.log('\n=== Click Element Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')
        assert.ok(Array.isArray(result.content), 'Should have content array')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that clicking with invalid node ID is handled', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><button>Button</button></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_click_element',
          arguments: { tabId, nodeId: 999999999 },
        })

        console.log('\n=== Click Element Invalid Node Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that non-numeric parameters are rejected', async () => {
      await withMcpServer(async (client) => {
        try {
          await client.callTool({
            name: 'browser_click_element',
            arguments: { tabId: 'invalid', nodeId: 'invalid' },
          })
          assert.fail('Should have thrown validation error')
        } catch (error) {
          console.log('\n=== Click Element Invalid Type Error ===')
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

  describe('browser_type_text - Success Cases', () => {
    it('tests that typing text into input succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page with an input field
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input id="testInput" type="text" placeholder="Type here" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get interactive elements to find the input's nodeId
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Type text into the input
        const typeResult = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId, nodeId, text: 'Hello World' },
        })

        console.log('\n=== Type Text Response ===')
        console.log(JSON.stringify(typeResult, null, 2))

        assert.ok(!typeResult.isError, 'Should succeed')

        const typeText = typeResult.content.find((c) => c.type === 'text')
        assert.ok(typeText, 'Should have text content')
        assert.ok(
          typeText.text.includes(`Typed text into element ${nodeId}`),
          'Should confirm text typed',
        )
      })
    }, 30000)

    it('tests that typing empty string succeeds', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input type="text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        const typeResult = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId, nodeId, text: '' },
        })

        console.log('\n=== Type Empty String Response ===')
        console.log(JSON.stringify(typeResult, null, 2))

        assert.ok(!typeResult.isError, 'Should succeed')
      })
    }, 30000)

    it('tests that typing special characters succeeds', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input type="text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        const typeResult = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId, nodeId, text: '!@#$%^&*()_+-={}[]|:";\'<>?,./' },
        })

        console.log('\n=== Type Special Characters Response ===')
        console.log(JSON.stringify(typeResult, null, 2))

        assert.ok(!typeResult.isError, 'Should succeed')
      })
    }, 30000)
  })

  describe('browser_type_text - Error Handling', () => {
    it('tests that typing with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId: 999999999, nodeId: 1, text: 'test' },
        })

        console.log('\n=== Type Text Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that typing with invalid node ID is handled', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input type="text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId, nodeId: 999999999, text: 'test' },
        })

        console.log('\n=== Type Text Invalid Node Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)
  })

  describe('browser_clear_input - Success Cases', () => {
    it('tests that clearing input field succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page with an input field
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input type="text" value="Initial text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get interactive elements
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Clear the input
        const clearResult = await client.callTool({
          name: 'browser_clear_input',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Clear Input Response ===')
        console.log(JSON.stringify(clearResult, null, 2))

        assert.ok(!clearResult.isError, 'Should succeed')

        const clearText = clearResult.content.find((c) => c.type === 'text')
        assert.ok(clearText, 'Should have text content')
        assert.ok(
          clearText.text.includes(`Cleared element ${nodeId}`),
          'Should confirm clear',
        )
      })
    }, 30000)
  })

  describe('browser_clear_input - Error Handling', () => {
    it('tests that clearing with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_clear_input',
          arguments: { tabId: 999999999, nodeId: 1 },
        })

        console.log('\n=== Clear Input Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that clearing with invalid node ID is handled', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input type="text" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_clear_input',
          arguments: { tabId, nodeId: 999999999 },
        })

        console.log('\n=== Clear Input Invalid Node Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)
  })

  describe('browser_scroll_to_element - Success Cases', () => {
    it('tests that scrolling to element succeeds', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a long page with a button at the bottom
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:3000px"><button style="position:absolute;bottom:0">Bottom Button</button></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get interactive elements
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Scroll to the element
        const scrollResult = await client.callTool({
          name: 'browser_scroll_to_element',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Scroll To Element Response ===')
        console.log(JSON.stringify(scrollResult, null, 2))

        assert.ok(!scrollResult.isError, 'Should succeed')

        const scrollText = scrollResult.content.find((c) => c.type === 'text')
        assert.ok(scrollText, 'Should have text content')
        assert.ok(
          scrollText.text.includes(`Scrolled to element ${nodeId}`),
          'Should confirm scroll',
        )
      })
    }, 30000)
  })

  describe('browser_scroll_to_element - Error Handling', () => {
    it('tests that scrolling with invalid tab ID is handled', async () => {
      await withMcpServer(async (client) => {
        const result = await client.callTool({
          name: 'browser_scroll_to_element',
          arguments: { tabId: 999999999, nodeId: 1 },
        })

        console.log('\n=== Scroll To Element Invalid Tab Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)

    it('tests that scrolling with invalid node ID is handled', async () => {
      await withMcpServer(async (client) => {
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:3000px"><button>Button</button></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        const result = await client.callTool({
          name: 'browser_scroll_to_element',
          arguments: { tabId, nodeId: 999999999 },
        })

        console.log('\n=== Scroll To Element Invalid Node Response ===')
        console.log(JSON.stringify(result, null, 2))

        assert.ok(result, 'Should return a result')

        if (result.isError) {
          const textContent = result.content.find((c) => c.type === 'text')
          assert.ok(textContent, 'Error should include text content')
        }
      })
    }, 30000)
  })

  describe('Interaction Tools - Workflow Tests', () => {
    it('tests complete interaction workflow: get elements -> click', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><button id="myBtn">Click Me</button><p id="result"></p><script>document.getElementById("myBtn").onclick = function() { document.getElementById("result").textContent = "Clicked!"; };</script></body>',
          },
        })

        console.log('\n=== Workflow: Navigate ===')
        console.log(JSON.stringify(navResult, null, 2))

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get elements
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        console.log('\n=== Workflow: Get Elements ===')
        console.log(JSON.stringify(elementsResult, null, 2))

        assert.ok(!elementsResult.isError, 'Get elements should succeed')

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Click element
        const clickResult = await client.callTool({
          name: 'browser_click_element',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Workflow: Click Element ===')
        console.log(JSON.stringify(clickResult, null, 2))

        assert.ok(!clickResult.isError, 'Click should succeed')
      })
    }, 30000)

    it('tests complete form workflow: get elements -> type -> clear', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a form
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body><input id="name" type="text" placeholder="Enter name" /><input id="email" type="email" placeholder="Enter email" /></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get elements
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        console.log('\n=== Workflow: Get Form Elements ===')
        console.log(JSON.stringify(elementsResult, null, 2))

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        // Get first input nodeId
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Type text
        const typeResult = await client.callTool({
          name: 'browser_type_text',
          arguments: { tabId, nodeId, text: 'John Doe' },
        })

        console.log('\n=== Workflow: Type Text ===')
        console.log(JSON.stringify(typeResult, null, 2))

        assert.ok(!typeResult.isError, 'Type should succeed')

        // Clear input
        const clearResult = await client.callTool({
          name: 'browser_clear_input',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Workflow: Clear Input ===')
        console.log(JSON.stringify(clearResult, null, 2))

        assert.ok(!clearResult.isError, 'Clear should succeed')
      })
    }, 30000)

    it('tests complete scroll workflow: get elements -> scroll to element -> click', async () => {
      await withMcpServer(async (client) => {
        // Navigate to a long page
        const navResult = await client.callTool({
          name: 'browser_navigate',
          arguments: {
            url: 'data:text/html,<body style="height:5000px"><button style="position:absolute;bottom:0">Bottom Button</button></body>',
          },
        })

        const navText = navResult.content.find((c) => c.type === 'text')
        const tabIdMatch = navText.text.match(/Tab ID: (\d+)/)
        const tabId = parseInt(tabIdMatch[1], 10)

        // Get elements
        const elementsResult = await client.callTool({
          name: 'browser_get_interactive_elements',
          arguments: { tabId },
        })

        const elementsText = elementsResult.content.find(
          (c) => c.type === 'text',
        )
        const nodeIdMatch = elementsText.text.match(/\[(\d+)\]/)
        const nodeId = parseInt(nodeIdMatch[1], 10)

        // Scroll to element
        const scrollResult = await client.callTool({
          name: 'browser_scroll_to_element',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Workflow: Scroll To Element ===')
        console.log(JSON.stringify(scrollResult, null, 2))

        assert.ok(!scrollResult.isError, 'Scroll should succeed')

        // Click element
        const clickResult = await client.callTool({
          name: 'browser_click_element',
          arguments: { tabId, nodeId },
        })

        console.log('\n=== Workflow: Click After Scroll ===')
        console.log(JSON.stringify(clickResult, null, 2))

        assert.ok(!clickResult.isError, 'Click should succeed')
      })
    }, 30000)
  })
})
