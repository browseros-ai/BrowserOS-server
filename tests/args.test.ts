/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import {describe, it} from 'node:test';

import {parseArguments} from '../src/args.js';

describe('args parsing', () => {
  it('parses valid cdp-port and mcp-port', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9222',
      '--mcp-port=9223',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      mcpPort: 9223,
    });
  });

  it('parses with different port values', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9347',
      '--mcp-port=8080',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9347,
      mcpPort: 8080,
    });
  });

  it('parses with minimum valid port (1)', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=1',
      '--mcp-port=1',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 1,
      mcpPort: 1,
    });
  });

  it('parses with maximum valid port (65535)', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=65535',
      '--mcp-port=65535',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 65535,
      mcpPort: 65535,
    });
  });

  it('parses arguments in any order', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--mcp-port=9223',
      '--cdp-port=9222',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9222,
      mcpPort: 9223,
    });
  });

  it('parses with typical BrowserOS ports', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=9001',
      '--mcp-port=9223',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 9001,
      mcpPort: 9223,
    });
  });

  it('parses with high port numbers', () => {
    const ports = parseArguments([
      'node',
      'index.js',
      '--cdp-port=54321',
      '--mcp-port=54322',
    ]);
    assert.deepStrictEqual(ports, {
      cdpPort: 54321,
      mcpPort: 54322,
    });
  });
});
