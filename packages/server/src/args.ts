/**
 * @license
 * Copyright 2025 BrowserOS
 */
import path from 'node:path';

import {Command, InvalidArgumentError} from 'commander';

import {version} from '../../../package.json' assert {type: 'json'};

import {loadConfig} from './config.js';
import {
  ServerConfigSchema,
  type ServerConfig,
  type PartialServerConfig,
} from './types.js';

export type {ServerConfig} from './types.js';

/**
 * Validate and parse a port number string.
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

  let tomlConfig: PartialServerConfig = {};
  if (options.config) {
    tomlConfig = loadConfig(options.config);
  }

  // Precedence: CLI > TOML > ENV > undefined
  const cdpPort =
    options.cdpPort ??
    tomlConfig.cdpPort ??
    (process.env.CDP_PORT ? parsePort(process.env.CDP_PORT) : null);
  const httpMcpPort =
    options.httpMcpPort ??
    tomlConfig.httpMcpPort ??
    (process.env.HTTP_MCP_PORT
      ? parsePort(process.env.HTTP_MCP_PORT)
      : undefined);
  const agentPort =
    options.agentPort ??
    tomlConfig.agentPort ??
    (process.env.AGENT_PORT ? parsePort(process.env.AGENT_PORT) : undefined);
  const extensionPort =
    options.extensionPort ??
    tomlConfig.extensionPort ??
    (process.env.EXTENSION_PORT
      ? parsePort(process.env.EXTENSION_PORT)
      : undefined);

  const cwd = process.cwd();
  const resourcesDir = resolvePath(
    options.resourcesDir ??
      tomlConfig.resourcesDir ??
      process.env.RESOURCES_DIR,
    cwd,
  );
  const executionDir = resolvePath(
    options.executionDir ??
      tomlConfig.executionDir ??
      process.env.EXECUTION_DIR,
    resourcesDir,
  );

  const mcpAllowRemote =
    options.mcpAllowRemote || tomlConfig.mcpAllowRemote || false;

  const rawConfig = {
    cdpPort,
    httpMcpPort,
    agentPort,
    extensionPort,
    resourcesDir,
    executionDir,
    mcpAllowRemote,
    instanceClientId: tomlConfig.instanceClientId,
    instanceInstallId: tomlConfig.instanceInstallId,
    instanceBrowserosVersion: tomlConfig.instanceBrowserosVersion,
    instanceChromiumVersion: tomlConfig.instanceChromiumVersion,
  };

  const result = ServerConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });
    console.error('Error: Invalid server configuration:');
    console.error(errors.join('\n'));
    console.error('\nProvide via --config, CLI flags, or .env file');
    process.exit(1);
  }

  return result.data;
}

function resolvePath(target: string | undefined, baseDir: string): string {
  if (!target) return baseDir;
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}
