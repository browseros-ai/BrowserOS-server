/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {Command, InvalidArgumentError} from 'commander';

export interface ServerPorts {
  cdpPort: number;
  httpMcpPort: number;
  mcpServerEnabled: boolean;
  // Future: httpsMcpPort?: number;
}

/**
 * Validate and parse a port number string.
 *
 * @param value - Port number as string
 * @returns Parsed port number
 * @throws InvalidArgumentError if port is invalid
 */
function parsePort(value: string): number {
  const port = parseInt(value, 10);

  if (isNaN(port)) {
    throw new InvalidArgumentError('Not a valid port number');
  }

  if (port < 1 || port > 65535) {
    throw new InvalidArgumentError('Port must be between 1 and 65535');
  }

  return port;
}

/**
 * Parse command-line arguments for BrowserOS MCP server.
 *
 * Required:
 * - --cdp-port <number>: Port where CDP WebSocket is listening
 * - --http-mcp-port <number>: Port where MCP HTTP server should listen
 *
 * Optional:
 * - --disable-mcp-server: Disable MCP server (default: server enabled)
 *
 * Exits with code 1 if arguments are invalid or missing.
 *
 * @param argv - Optional argv array for testing. Defaults to process.argv
 */
export function parseArguments(argv = process.argv): ServerPorts {
  const program = new Command();

  program
    .name('browseros-mcp')
    .description('BrowserOS MCP Server')
    .requiredOption('--cdp-port <port>', 'CDP WebSocket port', parsePort)
    .requiredOption(
      '--http-mcp-port <port>',
      'MCP HTTP server port',
      parsePort,
    )
    .option('--disable-mcp-server', 'Disable MCP server', false)
    .parse(argv);

  const options = program.opts();

  return {
    cdpPort: options.cdpPort,
    httpMcpPort: options.httpMcpPort,
    mcpServerEnabled: !options.disableMcpServer,
  };
}
