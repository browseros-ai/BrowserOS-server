/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Server configuration loading with multiple sources.
 * Precedence: CLI > Config File > Environment > Defaults
 */
import fs from 'node:fs';
import path from 'node:path';

import {Command, InvalidArgumentError} from 'commander';
import {z} from 'zod';

import {version} from '../../../package.json' with {type: 'json'};

const portSchema = z.number().int();

export const ServerConfigSchema = z.object({
  cdpPort: portSchema.nullable(),
  httpMcpPort: portSchema,
  agentPort: portSchema,
  extensionPort: portSchema,
  resourcesDir: z.string(),
  executionDir: z.string(),
  mcpAllowRemote: z.boolean(),
  instanceClientId: z.string().optional(),
  instanceInstallId: z.string().optional(),
  instanceBrowserosVersion: z.string().optional(),
  instanceChromiumVersion: z.string().optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

type PartialConfig = {
  cdpPort?: number | null;
  httpMcpPort?: number;
  agentPort?: number;
  extensionPort?: number;
  resourcesDir?: string;
  executionDir?: string;
  mcpAllowRemote?: boolean;
  instanceClientId?: string;
  instanceInstallId?: string;
  instanceBrowserosVersion?: string;
  instanceChromiumVersion?: string;
};

export type ConfigResult<T> = {ok: true; value: T} | {ok: false; error: string};

export function loadServerConfig(
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): ConfigResult<ServerConfig> {
  // 1. Parse CLI (commander with exitOverride - throws instead of exit)
  const cli = parseCli(argv);
  if (!cli.ok) return cli;

  // 2. Load config file (only if --config provided)
  const file = loadConfigFile(cli.value.configPath);
  if (!file.ok) return file;

  // 3. Load from environment
  const envConfig = loadEnv(env);

  // 4. Merge: Defaults < Env < File < CLI
  const merged = merge(
    defaults(cli.value.cwd),
    envConfig,
    file.value,
    cli.value.overrides,
  );

  // 5. Validate with Zod (single source of truth)
  const result = ServerConfigSchema.safeParse(merged);
  if (!result.success) {
    const errors = result.error.issues
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    return {
      ok: false,
      error: `Invalid server configuration:\n${errors}\n\nProvide via --config, CLI flags, or environment variables.`,
    };
  }

  return {ok: true, value: result.data};
}

interface CliResult {
  configPath?: string;
  cwd: string;
  overrides: PartialConfig;
}

function parseCli(argv: string[]): ConfigResult<CliResult> {
  const program = new Command();

  try {
    program
      .name('browseros-server')
      .description('BrowserOS Unified Server - MCP + Agent')
      .version(version)
      .option('--config <path>', 'Path to JSON configuration file')
      .option(
        '--cdp-port <port>',
        'CDP WebSocket port (optional)',
        parsePortArg,
      )
      .option('--http-mcp-port <port>', 'MCP HTTP server port', parsePortArg)
      .option('--agent-port <port>', 'Agent communication port', parsePortArg)
      .option(
        '--extension-port <port>',
        'Extension WebSocket port',
        parsePortArg,
      )
      .option('--resources-dir <path>', 'Resources directory path')
      .option(
        '--execution-dir <path>',
        'Execution directory for logs and configs',
      )
      .option(
        '--allow-remote-in-mcp',
        'Allow non-localhost MCP connections',
        false,
      )
      .option(
        '--disable-mcp-server',
        '[DEPRECATED] No-op, kept for backwards compatibility',
      )
      .exitOverride(err => {
        if (err.exitCode === 0) {
          process.exit(0);
        }
        throw err;
      })
      .parse(argv);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {ok: false, error: message};
  }

  const opts = program.opts();

  if (opts.disableMcpServer) {
    console.warn(
      'Warning: --disable-mcp-server is deprecated and has no effect',
    );
  }

  const cwd = process.cwd();

  return {
    ok: true,
    value: {
      configPath: opts.config,
      cwd,
      overrides: filterUndefined({
        cdpPort: opts.cdpPort,
        httpMcpPort: opts.httpMcpPort,
        agentPort: opts.agentPort,
        extensionPort: opts.extensionPort,
        resourcesDir: opts.resourcesDir
          ? resolvePath(opts.resourcesDir, cwd)
          : undefined,
        executionDir: opts.executionDir
          ? resolvePath(opts.executionDir, cwd)
          : undefined,
        mcpAllowRemote: opts.allowRemoteInMcp || undefined,
      }),
    },
  };
}

function parsePortArg(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port)) {
    throw new InvalidArgumentError('Not a valid port number');
  }
  return port;
}

function loadConfigFile(explicitPath?: string): ConfigResult<PartialConfig> {
  if (!explicitPath) {
    return {ok: true, value: {}};
  }

  const absPath = path.isAbsolute(explicitPath)
    ? explicitPath
    : path.resolve(process.cwd(), explicitPath);

  if (!fs.existsSync(absPath)) {
    return {ok: false, error: `Config file not found: ${absPath}`};
  }

  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    const cfg = JSON.parse(content);
    const configDir = path.dirname(absPath);

    return {
      ok: true,
      value: filterUndefined({
        cdpPort: cfg.ports?.cdp,
        httpMcpPort: cfg.ports?.http_mcp,
        agentPort: cfg.ports?.agent,
        extensionPort: cfg.ports?.extension,
        resourcesDir: resolvePathIfString(
          cfg.directories?.resources,
          configDir,
        ),
        executionDir: resolvePathIfString(
          cfg.directories?.execution,
          configDir,
        ),
        mcpAllowRemote:
          cfg.flags?.allow_remote_in_mcp === true ? true : undefined,
        instanceClientId:
          typeof cfg.instance?.client_id === 'string'
            ? cfg.instance.client_id
            : undefined,
        instanceInstallId:
          typeof cfg.instance?.install_id === 'string'
            ? cfg.instance.install_id
            : undefined,
        instanceBrowserosVersion:
          typeof cfg.instance?.browseros_version === 'string'
            ? cfg.instance.browseros_version
            : undefined,
        instanceChromiumVersion:
          typeof cfg.instance?.chromium_version === 'string'
            ? cfg.instance.chromium_version
            : undefined,
      }),
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {ok: false, error: `Config file error: ${message}`};
  }
}

function loadEnv(env: NodeJS.ProcessEnv): PartialConfig {
  return filterUndefined({
    cdpPort: env.CDP_PORT ? safeParseInt(env.CDP_PORT) : undefined,
    httpMcpPort: env.HTTP_MCP_PORT
      ? safeParseInt(env.HTTP_MCP_PORT)
      : undefined,
    agentPort: env.AGENT_PORT ? safeParseInt(env.AGENT_PORT) : undefined,
    extensionPort: env.EXTENSION_PORT
      ? safeParseInt(env.EXTENSION_PORT)
      : undefined,
    resourcesDir: env.RESOURCES_DIR,
    executionDir: env.EXECUTION_DIR,
    instanceInstallId: env.INSTALL_ID,
    instanceClientId: env.CLIENT_ID,
  });
}

function safeParseInt(value: string): number | undefined {
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

function defaults(cwd: string): PartialConfig {
  return {
    cdpPort: null,
    resourcesDir: cwd,
    executionDir: cwd,
    mcpAllowRemote: false,
  };
}

function merge(...configs: PartialConfig[]): PartialConfig {
  const result: PartialConfig = {};
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

function filterUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  ) as Partial<T>;
}

function resolvePath(target: string, baseDir: string): string {
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}

function resolvePathIfString(
  val: unknown,
  baseDir: string,
): string | undefined {
  if (typeof val !== 'string') return undefined;
  return resolvePath(val, baseDir);
}
