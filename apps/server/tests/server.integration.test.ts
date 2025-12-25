/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Integration tests for the consolidated HTTP server.
 * Starts BrowserOS, starts HTTP server, tests all endpoints, then cleans up.
 */

import { afterAll, beforeAll, describe, it, setDefaultTimeout } from 'bun:test'
import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { URL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { cleanupBrowser, ensureBrowserOS, killProcessOnPort } from './utils.js'

// Set longer timeout for hooks and tests (30 seconds) - browser startup/shutdown takes time
setDefaultTimeout(30000)

// Test configuration
const CDP_PORT = parseInt(process.env.CDP_PORT || '9001', 10)
const HTTP_PORT = parseInt(process.env.HTTP_MCP_PORT || '9002', 10)
const EXTENSION_PORT = parseInt(process.env.EXTENSION_PORT || '9004', 10)
const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`

let serverProcess: ReturnType<typeof spawn> | null = null
let mcpClient: Client | null = null
let mcpTransport: StreamableHTTPClientTransport | null = null

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const _response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    })
    return false // Port is in use
  } catch {
    return true // Port is available
  }
}

/**
 * Wait for server to be ready by polling health endpoint
 */
async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        return
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Server failed to start within timeout')
}

describe('HTTP Server Integration Tests', () => {
  beforeAll(async () => {
    // Start BrowserOS (or reuse if already running)
    await ensureBrowserOS({
      cdpPort: CDP_PORT,
      httpPort: HTTP_PORT,
      extensionPort: EXTENSION_PORT,
    })

    // Check if server port is already in use
    await killProcessOnPort(HTTP_PORT)
    await killProcessOnPort(EXTENSION_PORT)

    const portAvailable = await isPortAvailable(HTTP_PORT)
    if (!portAvailable) {
      console.log(
        `Server already running on port ${HTTP_PORT}, using existing server\n`,
      )
      return
    }

    // Start HTTP server
    console.log(`Starting HTTP server on port ${HTTP_PORT}...`)
    serverProcess = spawn(
      'bun',
      [
        'apps/server/src/index.ts',
        '--cdp-port',
        CDP_PORT.toString(),
        '--http-mcp-port',
        HTTP_PORT.toString(),
        '--extension-port',
        EXTENSION_PORT.toString(),
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
      },
    )

    serverProcess.stdout?.on('data', (data) => {
      console.log(`[SERVER] ${data.toString().trim()}`)
    })

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`)
    })

    serverProcess.on('error', (error) => {
      console.error('Failed to start HTTP server:', error)
    })

    // Wait for server to be ready
    await waitForServer()
    console.log('HTTP server is ready\n')

    // Connect MCP client
    mcpClient = new Client({
      name: 'browseros-integration-test-client',
      version: '1.0.0',
    })

    const serverUrl = new URL(`${BASE_URL}/mcp`)
    mcpTransport = new StreamableHTTPClientTransport(serverUrl)

    await mcpClient.connect(mcpTransport)
    console.log('MCP client connected\n')
  })

  afterAll(async () => {
    // Close MCP client
    if (mcpTransport) {
      console.log('\nClosing MCP client...')
      await mcpTransport.close()
      mcpTransport = null
      mcpClient = null
      console.log('MCP client closed')
    }

    // Shutdown HTTP server
    if (serverProcess) {
      console.log('Shutting down HTTP server...')
      serverProcess.kill('SIGTERM')

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess?.kill('SIGKILL')
          resolve()
        }, 5000)

        serverProcess?.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      console.log('HTTP server stopped')
      serverProcess = null
    }

    // Cleanup BrowserOS if we started it
    // Set KEEP_BROWSER=1 to keep browser open for debugging
    if (!process.env.KEEP_BROWSER) {
      await cleanupBrowser()
    }
  })

  describe('Health endpoint', () => {
    it('responds with 200 OK', async () => {
      const response = await fetch(`${BASE_URL}/health`)
      assert.strictEqual(response.status, 200)

      const json = await response.json()
      assert.strictEqual(json.status, 'ok')
    })
  })

  describe('MCP endpoint', () => {
    it('lists available tools', async () => {
      assert.ok(mcpClient, 'MCP client should be connected')

      const result = await mcpClient.listTools()

      assert.ok(result.tools, 'Should return tools array')
      assert.ok(Array.isArray(result.tools), 'Tools should be an array')
      assert.ok(result.tools.length > 0, 'Should have at least one tool')

      console.log(`Found ${result.tools.length} tools`)
    })

    it('calls browser_list_tabs tool successfully', async () => {
      assert.ok(mcpClient, 'MCP client should be connected')

      const result = await mcpClient.callTool({
        name: 'browser_list_tabs',
        arguments: {},
      })

      assert.ok(result.content, 'Should return content')
      assert.ok(Array.isArray(result.content), 'Content should be an array')

      const textContent = result.content.find(
        (item) => item.type === 'text' && typeof item.text === 'string',
      )
      assert.ok(textContent, 'Should include text content')
      console.log('browser_list_tabs content:', textContent?.text ?? '')
      // Just verify the API works and returns a response (extension connection status may vary)
      assert.ok(textContent.text, 'Response should contain text')
      console.log(
        'browser_list_tabs returned:',
        result.content.length,
        'content items',
      )
    })

    it('handles invalid tool name gracefully', async () => {
      assert.ok(mcpClient, 'MCP client should be connected')

      try {
        await mcpClient.callTool({
          name: 'this_tool_does_not_exist',
          arguments: {},
        })
        assert.fail('Should have thrown an error for invalid tool')
      } catch (error) {
        // Expected - invalid tool name should throw
        assert.ok(error, 'Should throw error for invalid tool')
      }
    })
  })

  describe('Concurrent request handling', () => {
    it('handles multiple simultaneous requests without conflicts', async () => {
      assert.ok(mcpClient, 'MCP client should be connected')
      const client = mcpClient

      const requests = Array.from({ length: 10 }, () => client.listTools())

      const results = await Promise.all(requests)

      // All should succeed and return tools
      results.forEach((result) => {
        assert.ok(result.tools, 'Each request should return tools')
        assert.ok(Array.isArray(result.tools), 'Tools should be an array')
        assert.ok(result.tools.length > 0, 'Should have tools')
      })

      console.log(`All ${results.length} concurrent requests succeeded`)
    })
  })

  describe('Chat endpoint', () => {
    it(
      'streams a chat response with BrowserOS provider',
      async () => {
        const conversationId = crypto.randomUUID()

        const response = await fetch(`${BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
            message: 'Open amazon.com in a new tab',
            provider: 'browseros',
            model: 'claude-sonnet-4-20250514',
          }),
        })

        assert.strictEqual(response.status, 200, 'Chat should return 200')
        assert.ok(
          response.headers.get('content-type')?.includes('text/event-stream'),
          'Should return SSE stream',
        )

        // Read and parse SSE stream
        const reader = response.body?.getReader()
        assert.ok(reader, 'Should have response body reader')

        const decoder = new TextDecoder()
        let fullResponse = ''
        let eventCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullResponse += chunk
          eventCount++

          // Log first few events for debugging
          if (eventCount <= 3) {
            console.log(`[CHAT] Event ${eventCount}:`, chunk.slice(0, 100))
          }
        }

        console.log(
          `[CHAT] Received ${eventCount} events, ${fullResponse.length} bytes total`,
        )

        // Verify we got SSE formatted data
        assert.ok(
          fullResponse.includes('data:'),
          'Should contain SSE data events',
        )

        // Cleanup: delete the session
        const deleteResponse = await fetch(
          `${BASE_URL}/chat/${conversationId}`,
          {
            method: 'DELETE',
          },
        )
        assert.strictEqual(deleteResponse.status, 200, 'Should delete session')
      },
      { timeout: 30000 },
    )

    it('returns 400 for invalid chat request', async () => {
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          message: 'Hello',
        }),
      })

      assert.strictEqual(
        response.status,
        400,
        'Should return 400 for invalid request',
      )
    })
  })
})
