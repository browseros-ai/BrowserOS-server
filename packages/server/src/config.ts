/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * TOML configuration file loader
 */
import fs from 'node:fs';
import path from 'node:path';

import {parse as parseToml} from 'smol-toml';

export interface TomlConfig {
  ports?: {
    cdp?: number;
    http_mcp?: number;
    agent?: number;
    extension?: number;
  };
  directories?: {
    resources?: string;
    execution?: string;
  };
  mcp?: {
    allow_remote?: boolean;
  };
}

export interface ResolvedConfig {
  cdpPort?: number;
  httpMcpPort?: number;
  agentPort?: number;
  extensionPort?: number;
  resourcesDir?: string;
  executionDir?: string;
  mcpAllowRemote?: boolean;
}

/**
 * Load and parse a TOML configuration file.
 * Relative paths in the config are resolved relative to the config file's directory.
 */
export function loadConfig(configPath: string): ResolvedConfig {
  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Config file not found: ${absoluteConfigPath}`);
  }

  const configDir = path.dirname(absoluteConfigPath);
  const content = fs.readFileSync(absoluteConfigPath, 'utf-8');

  let parsed: TomlConfig;
  try {
    parsed = parseToml(content) as TomlConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse TOML config: ${message}`);
  }

  const resolved: ResolvedConfig = {};

  if (parsed.ports) {
    if (parsed.ports.cdp !== undefined) {
      resolved.cdpPort = validatePort(parsed.ports.cdp, 'ports.cdp');
    }
    if (parsed.ports.http_mcp !== undefined) {
      resolved.httpMcpPort = validatePort(
        parsed.ports.http_mcp,
        'ports.http_mcp',
      );
    }
    if (parsed.ports.agent !== undefined) {
      resolved.agentPort = validatePort(parsed.ports.agent, 'ports.agent');
    }
    if (parsed.ports.extension !== undefined) {
      resolved.extensionPort = validatePort(
        parsed.ports.extension,
        'ports.extension',
      );
    }
  }

  if (parsed.directories) {
    if (parsed.directories.resources !== undefined) {
      resolved.resourcesDir = resolvePath(
        parsed.directories.resources,
        configDir,
      );
    }
    if (parsed.directories.execution !== undefined) {
      resolved.executionDir = resolvePath(
        parsed.directories.execution,
        configDir,
      );
    }
  }

  if (parsed.mcp) {
    if (parsed.mcp.allow_remote !== undefined) {
      if (typeof parsed.mcp.allow_remote !== 'boolean') {
        throw new Error(`Invalid config: mcp.allow_remote must be a boolean`);
      }
      resolved.mcpAllowRemote = parsed.mcp.allow_remote;
    }
  }

  return resolved;
}

function validatePort(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Invalid config: ${field} must be an integer`);
  }
  if (value < 1 || value > 65535) {
    throw new Error(`Invalid config: ${field} must be between 1 and 65535`);
  }
  return value;
}

function resolvePath(target: string, configDir: string): string {
  return path.isAbsolute(target) ? target : path.resolve(configDir, target);
}
