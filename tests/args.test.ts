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

  it('parses with different port values', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9347',
      '--http-mcp-port=8080',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9347,
      httpMcpPort: 8080,
      mcpServerEnabled: true,
    });
  });

  it('parses with minimum valid port (1)', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=1',
      '--http-mcp-port=1',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 1,
      httpMcpPort: 1,
      mcpServerEnabled: true,
    });
  });

  it('parses with maximum valid port (65535)', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=65535',
      '--http-mcp-port=65535',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 65535,
      httpMcpPort: 65535,
      mcpServerEnabled: true,
    });
  });

  it('parses arguments in any order', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--http-mcp-port=9223',
      '--cdp-port=9222',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      httpMcpPort: 9223,
      mcpServerEnabled: true,
    });
  });

  it('parses with typical BrowserOS ports', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9001',
      '--http-mcp-port=9223',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9001,
      httpMcpPort: 9223,
      mcpServerEnabled: true,
    });
  });

  it('parses with high port numbers', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=54321',
      '--http-mcp-port=54322',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 54321,
      httpMcpPort: 54322,
      mcpServerEnabled: true,
    });
  });

  it('defaults mcpServerEnabled to true when flag not provided', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9222',
      '--http-mcp-port=9223',
    ]);
    assert.strictEqual(ports.mcpServerEnabled, true);
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
