/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {Command, InvalidArgumentError} from 'commander';

export interface ServerPorts {
  cdpPort: number | null;
  httpMcpPort: number;
  agentPort: number;
  extensionPort: number;
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
 * Parse command-line arguments for BrowserOS unified server.
 *
 * CLI args take precedence, fallback to environment variables from .env
 *
 * Required (from CLI or .env):
 * - HTTP_MCP_PORT: MCP HTTP server port
 * - AGENT_PORT: Agent WebSocket server port
 * - EXTENSION_PORT: Extension WebSocket port
 *
 * Optional:
 * - CDP_PORT: Chrome DevTools Protocol port
 * - --disable-mcp-server: Disable MCP server
 *
 * @param argv - Optional argv array for testing. Defaults to process.argv
 */
export function parseArguments(argv = process.argv): ServerPorts {
  const program = new Command();

  program
    .name('browseros-server')
    .description('BrowserOS Unified Server - MCP + Agent')
    .option('--cdp-port <port>', 'CDP WebSocket port (optional)', parsePort)
    .option('--http-mcp-port <port>', 'MCP HTTP server port', parsePort)
    .option('--agent-port <port>', 'Agent communication port', parsePort)
    .option('--extension-port <port>', 'Extension WebSocket port', parsePort)
    .option('--disable-mcp-server', 'Disable MCP server', false)
    .exitOverride()
    .parse(argv);

  const options = program.opts();

  const cdpPort =
    options.cdpPort ??
    (process.env.CDP_PORT ? parsePort(process.env.CDP_PORT) : undefined);
  const httpMcpPort =
    options.httpMcpPort ??
    (process.env.HTTP_MCP_PORT
      ? parsePort(process.env.HTTP_MCP_PORT)
      : undefined);
  const agentPort =
    options.agentPort ??
    (process.env.AGENT_PORT ? parsePort(process.env.AGENT_PORT) : undefined);
  const extensionPort =
    options.extensionPort ??
    (process.env.EXTENSION_PORT
      ? parsePort(process.env.EXTENSION_PORT)
      : undefined);

  const missing: string[] = [];
  if (!httpMcpPort) missing.push('HTTP_MCP_PORT');
  if (!agentPort) missing.push('AGENT_PORT');
  if (!extensionPort) missing.push('EXTENSION_PORT');

  if (missing.length > 0) {
    console.error(
      `Error: Missing required port configuration: ${missing.join(', ')}`,
    );
    console.error('Please set these in .env file');
    process.exit(1);
  }

  return {
    cdpPort,
    httpMcpPort: httpMcpPort!,
    agentPort: agentPort!,
    extensionPort: extensionPort!,
    mcpServerEnabled: !options.disableMcpServer,
  };
}
