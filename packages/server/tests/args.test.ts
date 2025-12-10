/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';

import {describe, it, beforeEach, afterEach} from 'bun:test';

import {parseArguments} from '../src/args.js';

describe('args parsing', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    // Save original environment
    originalEnv = {...process.env};

    // Clear relevant env vars to ensure test isolation
    delete process.env.CDP_PORT;
    delete process.env.HTTP_MCP_PORT;
    delete process.env.AGENT_PORT;
    delete process.env.EXTENSION_PORT;

    // Mock process.exit to capture exit calls
    exitCode = undefined;
    originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit(${code}) called`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore process.exit
    process.exit = originalExit;
  });

  it('parses valid cdp-port, http-mcp-port, agent-port, and extension-port', () => {
    const config = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--extension-port=9224',
    ]);
    assert.strictEqual(config.cdpPort, 9222);
    assert.strictEqual(config.httpMcpPort, 9223);
    assert.strictEqual(config.agentPort, 9225);
    assert.strictEqual(config.extensionPort, 9224);
    assert.strictEqual(config.mcpAllowRemote, false);
  });

  it('parses --mcp-allow-remote flag', () => {
    const config = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--extension-port=9224',
      '--mcp-allow-remote',
    ]);
    assert.strictEqual(config.mcpAllowRemote, true);
  });

  it('--disable-mcp-server is deprecated no-op', () => {
    const config = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--extension-port=9224',
      '--disable-mcp-server',
    ]);
    assert.strictEqual(config.cdpPort, 9222);
    assert.strictEqual(config.httpMcpPort, 9223);
  });

  it('reads from environment variables when CLI args not provided', () => {
    process.env.CDP_PORT = '9222';
    process.env.HTTP_MCP_PORT = '9223';
    process.env.AGENT_PORT = '9225';
    process.env.EXTENSION_PORT = '9224';

    const config = parseArguments(['bun', 'src/index.ts']);
    assert.strictEqual(config.cdpPort, 9222);
    assert.strictEqual(config.httpMcpPort, 9223);
    assert.strictEqual(config.agentPort, 9225);
    assert.strictEqual(config.extensionPort, 9224);
  });

  it('CLI args take precedence over environment variables', () => {
    process.env.CDP_PORT = '1111';
    process.env.HTTP_MCP_PORT = '2222';
    process.env.AGENT_PORT = '3333';
    process.env.EXTENSION_PORT = '4444';

    const config = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--extension-port=9224',
    ]);
    assert.strictEqual(config.cdpPort, 9222);
    assert.strictEqual(config.httpMcpPort, 9223);
    assert.strictEqual(config.agentPort, 9225);
    assert.strictEqual(config.extensionPort, 9224);
  });

  it('calls process.exit when http-mcp-port is missing', () => {
    assert.throws(
      () => {
        parseArguments([
          'bun',
          'src/index.ts',
          '--cdp-port=9222',
          '--agent-port=9225',
          '--extension-port=9224',
        ]);
      },
      {message: /process\.exit\(1\) called/},
    );
    assert.strictEqual(exitCode, 1);
  });

  it('calls process.exit when agent-port is missing', () => {
    assert.throws(
      () => {
        parseArguments([
          'bun',
          'src/index.ts',
          '--cdp-port=9222',
          '--http-mcp-port=9223',
          '--extension-port=9224',
        ]);
      },
      {message: /process\.exit\(1\) called/},
    );
    assert.strictEqual(exitCode, 1);
  });

  it('calls process.exit when extension-port is missing', () => {
    assert.throws(
      () => {
        parseArguments([
          'bun',
          'src/index.ts',
          '--cdp-port=9222',
          '--http-mcp-port=9223',
          '--agent-port=9225',
        ]);
      },
      {message: /process\.exit\(1\) called/},
    );
    assert.strictEqual(exitCode, 1);
  });

  it('cdp-port is optional', () => {
    const config = parseArguments([
      'bun',
      'src/index.ts',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--extension-port=9224',
    ]);
    assert.strictEqual(config.cdpPort, undefined);
    assert.strictEqual(config.httpMcpPort, 9223);
    assert.strictEqual(config.agentPort, 9225);
    assert.strictEqual(config.extensionPort, 9224);
  });
});
