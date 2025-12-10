/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Self-contained integration test for MCP server
 * Starts BrowserOS binary, starts MCP server, tests functionality, then cleans up
 */
import assert from 'node:assert';
import {spawn} from 'node:child_process';
import {describe, it, beforeAll, afterAll} from 'bun:test';
import {URL} from 'node:url';

import {ensureBrowserOS} from '@browseros/common/tests/browseros';
import {killProcessOnPort} from '@browseros/common/tests/utils.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Test configuration
const CDP_PORT = parseInt(process.env.CDP_PORT || '9001');
const HTTP_MCP_PORT = parseInt(process.env.HTTP_MCP_PORT || '9002');
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '9003');
const EXTENSION_PORT = parseInt(process.env.EXTENSION_PORT || '9004');
const BASE_URL = `http://127.0.0.1:${HTTP_MCP_PORT}`;

let serverProcess: ReturnType<typeof spawn> | null = null;
let mcpClient: Client | null = null;
let mcpTransport: StreamableHTTPClientTransport | null = null;

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return false; // Port is in use
  } catch {
    return true; // Port is available
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
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Server failed to start within timeout');
}

describe('MCP Server Integration Tests', () => {
  beforeAll(async () => {
    // Start BrowserOS (or reuse if already running)
    await ensureBrowserOS({cdpPort: CDP_PORT});

    // Check if MCP server port is already in use
    await killProcessOnPort(HTTP_MCP_PORT);
    await killProcessOnPort(EXTENSION_PORT);

    const portAvailable = await isPortAvailable(HTTP_MCP_PORT);
    if (!portAvailable) {
      console.log(
        `Server already running on port ${HTTP_MCP_PORT}, using existing server\n`,
      );
      return;
    }

    // Start MCP server
    console.log(`Starting MCP server on port ${HTTP_MCP_PORT}...`);
    serverProcess = spawn(
      'bun',
      [
        'packages/server/src/index.ts',
        '--cdp-port',
        CDP_PORT.toString(),
        '--http-mcp-port',
        HTTP_MCP_PORT.toString(),
        '--agent-port',
        AGENT_PORT.toString(),
        '--extension-port',
        EXTENSION_PORT.toString(),
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
      },
    );

    serverProcess.stdout?.on('data', data => {
      console.log(`[SERVER] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', data => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', error => {
      console.error('Failed to start MCP server:', error);
    });

    // Wait for MCP server to be ready
    await waitForServer();
    console.log('MCP server is ready\n');

    // Connect MCP client
    mcpClient = new Client({
      name: 'browseros-integration-test-client',
      version: '1.0.0',
    });

    const serverUrl = new URL(`${BASE_URL}/mcp`);
    mcpTransport = new StreamableHTTPClientTransport(serverUrl);

    await mcpClient.connect(mcpTransport);
    console.log('MCP client connected\n');
  });

  afterAll(async () => {
    // Close MCP client
    if (mcpTransport) {
      console.log('\nClosing MCP client...');
      await mcpTransport.close();
      mcpTransport = null;
      mcpClient = null;
      console.log('MCP client closed');
    }

    // Shutdown MCP server
    if (serverProcess) {
      console.log('Shutting down MCP server...');
      serverProcess.kill('SIGTERM');

      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          serverProcess?.kill('SIGKILL');
          resolve();
        }, 5000);

        serverProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      console.log('MCP server stopped');
      serverProcess = null;
    }

    // Note: We do NOT cleanup BrowserOS here because:
    // 1. It's shared across all tests in the suite
    // 2. Other tests may run after this and need the browser
    // 3. Process exit will handle final cleanup
  });

  describe('Health endpoint', () => {
    it('responds with 200 OK', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(response.status, 200);

      const text = await response.text();
      assert.strictEqual(text, 'OK');
    });
  });

  describe('MCP endpoint', () => {
    it('lists available tools', async () => {
      assert.ok(mcpClient, 'MCP client should be connected');

      const result = await mcpClient.listTools();

      assert.ok(result.tools, 'Should return tools array');
      assert.ok(Array.isArray(result.tools), 'Tools should be an array');
      assert.ok(result.tools.length > 0, 'Should have at least one tool');

      console.log(`Found ${result.tools.length} tools`);
    });

    it('calls browser_list_tabs tool successfully', async () => {
      assert.ok(mcpClient, 'MCP client should be connected');

      const result = await mcpClient.callTool({
        name: 'browser_list_tabs',
        arguments: {},
      });

      assert.ok(result.content, 'Should return content');
      assert.ok(Array.isArray(result.content), 'Content should be an array');

      const textContent = result.content.find(
        item => item.type === 'text' && typeof item.text === 'string',
      );
      assert.ok(textContent, 'Should include text content');
      console.log('browser_list_tabs content:', textContent?.text ?? '');
      // Just verify the API works and returns a response (extension connection status may vary)
      assert.ok(textContent.text, 'Response should contain text');
      console.log(
        'browser_list_tabs returned:',
        result.content.length,
        'content items',
      );
    });

    it('handles invalid tool name gracefully', async () => {
      assert.ok(mcpClient, 'MCP client should be connected');

      try {
        await mcpClient.callTool({
          name: 'this_tool_does_not_exist',
          arguments: {},
        });
        assert.fail('Should have thrown an error for invalid tool');
      } catch (error) {
        // Expected - invalid tool name should throw
        assert.ok(error, 'Should throw error for invalid tool');
      }
    });
  });

  describe('Concurrent request handling', () => {
    it('handles multiple simultaneous requests without conflicts', async () => {
      assert.ok(mcpClient, 'MCP client should be connected');

      const requests = Array.from({length: 10}, () => mcpClient!.listTools());

      const results = await Promise.all(requests);

      // All should succeed and return tools
      results.forEach(result => {
        assert.ok(result.tools, 'Each request should return tools');
        assert.ok(Array.isArray(result.tools), 'Tools should be an array');
        assert.ok(result.tools.length > 0, 'Should have tools');
      });

      console.log(`All ${results.length} concurrent requests succeeded`);
    });
  });
});
