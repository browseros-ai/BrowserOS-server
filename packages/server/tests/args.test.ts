/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import {describe, it} from 'node:test';

import {parseArguments} from '../src/args.js';

describe('args parsing', () => {
  it('parses valid cdp-port and http-mcp-port', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      httpMcpPort: 9223,
      mcpServerEnabled: true,
    });
  });

  it('parses --disable-mcp-server flag', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
      '--disable-mcp-server',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      httpMcpPort: 9223,
      mcpServerEnabled: false,
    });
  });
});
