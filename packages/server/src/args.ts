/**
 * @license
 * Copyright 2025 BrowserOS
 */
import path from 'node:path';

import {Command, InvalidArgumentError} from 'commander';

import {version} from '../../../package.json' assert {type: 'json'};

import {loadConfig, type ResolvedConfig} from './config.js';

export interface ServerConfig {
  cdpPort: number | null;
  httpMcpPort: number;
  agentPort: number;
  extensionPort: number;
  resourcesDir: string;
  executionDir: string;
  mcpAllowRemote: boolean;
  metricsClientId?: string;
  metricsInstallId?: string;
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
 * Precedence: CLI args > TOML config > environment variables > defaults
 *
 * Required (from CLI, config, or env):
 * - HTTP_MCP_PORT: MCP HTTP server port
 * - AGENT_PORT: Agent WebSocket server port
 * - EXTENSION_PORT: Extension WebSocket port
 *
 * Optional:
 * - CDP_PORT: Chrome DevTools Protocol port
 * - --config: Path to TOML configuration file
 * - --mcp-allow-remote: Allow non-localhost MCP connections
 *
 * @param argv - Optional argv array for testing. Defaults to process.argv
 */
export function parseArguments(argv = process.argv): ServerConfig {
  const program = new Command();

  program
    .name('browseros-server')
    .description('BrowserOS Unified Server - MCP + Agent')
    .version(version)
    .option('--config <path>', 'Path to TOML configuration file')
    .option('--cdp-port <port>', 'CDP WebSocket port (optional)', parsePort)
    .option('--http-mcp-port <port>', 'MCP HTTP server port', parsePort)
    .option('--agent-port <port>', 'Agent communication port', parsePort)
    .option('--extension-port <port>', 'Extension WebSocket port', parsePort)
    .option('--resources-dir <path>', 'Resources directory path')
    .option(
      '--execution-dir <path>',
      'Execution directory for logs and configs',
    )
    .option('--mcp-allow-remote', 'Allow non-localhost MCP connections', false)
    .option(
      '--disable-mcp-server',
      '[DEPRECATED] No-op, kept for backwards compatibility',
    )
    .exitOverride()
    .parse(argv);

  const options = program.opts();

  if (options.disableMcpServer) {
    console.warn(
      'Warning: --disable-mcp-server is deprecated and has no effect',
    );
  }

  let config: ResolvedConfig = {};
  if (options.config) {
    config = loadConfig(options.config);
  }

  // Precedence: CLI > TOML > ENV > undefined
  const cdpPort =
    options.cdpPort ??
    config.cdpPort ??
    (process.env.CDP_PORT ? parsePort(process.env.CDP_PORT) : undefined);
  const httpMcpPort =
    options.httpMcpPort ??
    config.httpMcpPort ??
    (process.env.HTTP_MCP_PORT
      ? parsePort(process.env.HTTP_MCP_PORT)
      : undefined);
  const agentPort =
    options.agentPort ??
    config.agentPort ??
    (process.env.AGENT_PORT ? parsePort(process.env.AGENT_PORT) : undefined);
  const extensionPort =
    options.extensionPort ??
    config.extensionPort ??
    (process.env.EXTENSION_PORT
      ? parsePort(process.env.EXTENSION_PORT)
      : undefined);

  const cwd = process.cwd();
  const resolvedResourcesDir = resolvePath(
    options.resourcesDir ?? config.resourcesDir ?? process.env.RESOURCES_DIR,
    cwd,
  );
  const resolvedExecutionDir = resolvePath(
    options.executionDir ?? config.executionDir ?? process.env.EXECUTION_DIR,
    resolvedResourcesDir,
  );

  const mcpAllowRemote =
    options.mcpAllowRemote || config.mcpAllowRemote || false;

  const missing: string[] = [];
  if (!httpMcpPort) missing.push('HTTP_MCP_PORT');
  if (!agentPort) missing.push('AGENT_PORT');
  if (!extensionPort) missing.push('EXTENSION_PORT');

  if (missing.length > 0) {
    console.error(
      `Error: Missing required port configuration: ${missing.join(', ')}`,
    );
    console.error('Provide via --config, CLI flags, or .env file');
    process.exit(1);
  }

  return {
    cdpPort,
    httpMcpPort: httpMcpPort!,
    agentPort: agentPort!,
    extensionPort: extensionPort!,
    resourcesDir: resolvedResourcesDir,
    executionDir: resolvedExecutionDir,
    mcpAllowRemote,
    metricsClientId: config.metricsClientId,
    metricsInstallId: config.metricsInstallId,
  };
}

function resolvePath(target: string | undefined, baseDir: string): string {
  if (!target) return baseDir;
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}
