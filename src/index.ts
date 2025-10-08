#!/usr/bin/env bun

/**
 * @license
 * Copyright 2025 BrowserOS
 */

if (typeof Bun === 'undefined') {
  console.error(
    'ERROR: BrowserOS MCP Server requires Bun runtime. Please install Bun from https://bun.sh',
  );
  process.exit(1);
}

await import('./main.js');

export {};
