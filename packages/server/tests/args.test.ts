/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import {describe, it} from 'node:test';

import {parseArguments} from '../src/args.js';

describe('args parsing', () => {
  it('parses valid cdp-port, http-mcp-port, and agent-port', () => {
    const ports = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      httpMcpPort: 9223,
      agentPort: 9225,
      extensionPort: 9224,
      mcpServerEnabled: true,
    });
  });

  it('parses --disable-mcp-server flag', () => {
    const ports = parseArguments([
      'bun',
      'src/index.ts',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--agent-port=9225',
      '--disable-mcp-server',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      httpMcpPort: 9223,
      agentPort: 9225,
      extensionPort: 9224,
      mcpServerEnabled: false,
    });
  });

  it('throws error when http-mcp-port is missing', () => {
    assert.throws(
      () => {
        parseArguments([
          'bun',
          'src/index.ts',
          '--cdp-port=9222',
          '--agent-port=9225',
        ]);
      },
      {name: 'CommanderError', message: /required option.*--http-mcp-port/i}
    );
  });

  it('throws error when agent-port is missing', () => {
    assert.throws(
      () => {
        parseArguments([
          'bun',
          'src/index.ts',
          '--cdp-port=9222',
          '--http-mcp-port=9223',
        ]);
      },
      {name: 'CommanderError', message: /required option.*--agent-port/i}
    );
  });
});
