/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {Command, InvalidArgumentError} from 'commander';

export interface ServerPorts {
  cdpPort: number;
  httpMcpPort: number;
  agentPort: number;
  extensionPort: number;
  mcpServerEnabled: boolean;
  agentServerEnabled: boolean;
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
 * Parse command-line arguments for BrowserOS unified server.
 *
 * Required:
 * - --http-mcp-port <number>: Port where MCP HTTP server should listen
 * - --agent-port <number>: Port for agent WebSocket server
 *
 * Optional:
 * - --cdp-port <number>: Port where CDP WebSocket is listening
 * - --disable-mcp-server: Disable MCP server (default: server enabled)
 *
 * Exits with code 1 if arguments are invalid or missing.
 *
 * @param argv - Optional argv array for testing. Defaults to process.argv
 */
export function parseArguments(argv = process.argv): ServerPorts {
  const program = new Command();

  program
    .name('browseros-server')
    .description('BrowserOS Unified Server - MCP + Agent')
    .option('--cdp-port <port>', 'CDP WebSocket port (optional)', parsePort)
    .requiredOption('--http-mcp-port <port>', 'MCP HTTP server port', parsePort)
    .requiredOption(
      '--agent-port <port>',
      'Agent communication port',
      parsePort,
    )
    .option(
      '--extension-port <port>',
      'WebSocket port for extension connection',
      parsePort,
      9224,
    )
    .option('--disable-mcp-server', 'Disable MCP server', false)
    .option('--disable-agent-server', 'Disable Agent server', false)
    .exitOverride()
    .parse(argv);

  const options = program.opts();

  return {
    cdpPort: options.cdpPort,
    httpMcpPort: options.httpMcpPort,
    agentPort: options.agentPort,
    extensionPort: options.extensionPort,
    mcpServerEnabled: !options.disableMcpServer,
    agentServerEnabled: !options.disableAgentServer,
  };
}
