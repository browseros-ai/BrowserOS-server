/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ServerPorts {
  cdpPort: number;
  mcpPort: number;
}

const USAGE = 'Usage: bun run index.ts --cdp-port=<port> --mcp-port=<port>';

function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function parsePort(arg: string, argName: string): number {
  const value = arg.split('=')[1];

  if (!value) {
    exitWithError(`Missing value for ${argName}`);
  }

  const port = parseInt(value, 10);

  if (isNaN(port)) {
    exitWithError(`Invalid value for ${argName}: "${value}"`);
  }

  if (port < 1 || port > 65535) {
    exitWithError(`${argName} must be between 1 and 65535, got: ${port}`);
  }

  return port;
}

/**
 * Parse command-line arguments for BrowserOS MCP server.
 *
 * Expects exactly two arguments:
 * - --cdp-port=<number>: Port where CDP WebSocket is listening
 * - --mcp-port=<number>: Port where MCP HTTP server should listen
 *
 * Exits with code 1 if arguments are missing, invalid, or unknown arguments are provided.
 *
 * @param argv - Optional argv array for testing. Defaults to process.argv
 */
export function parseArguments(argv = process.argv): ServerPorts {
  const args = argv.slice(2);

  let cdpPort: number | undefined;
  let mcpPort: number | undefined;

  for (const arg of args) {
    if (arg.startsWith('--cdp-port=')) {
      cdpPort = parsePort(arg, '--cdp-port');
    } else if (arg.startsWith('--mcp-port=')) {
      mcpPort = parsePort(arg, '--mcp-port');
    } else {
      exitWithError(`Unknown argument: "${arg}"`);
    }
  }

  if (cdpPort === undefined) {
    exitWithError('Missing required argument --cdp-port=<port>');
  }

  if (mcpPort === undefined) {
    exitWithError('Missing required argument --mcp-port=<port>');
  }

  return { cdpPort, mcpPort };
}
