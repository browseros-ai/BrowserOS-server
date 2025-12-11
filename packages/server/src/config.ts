/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * JSON configuration file loader.
 * Using JSON as Chromium has native JSON support but no TOML support.
 */
import fs from 'node:fs';
import path from 'node:path';

import type {PartialServerConfig} from './types.js';

/**
 * Raw JSON config structure (snake_case keys matching JSON file)
 */
interface JsonConfig {
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
  flags?: {
    allow_remote_in_mcp?: boolean;
  };
  instance?: {
    client_id?: string;
    install_id?: string;
    browseros_version?: string;
    chromium_version?: string;
  };
}

/**
 * Load and parse a JSON configuration file.
 * Relative paths in the config are resolved relative to the config file's directory.
 */
export function loadConfig(configPath: string): PartialServerConfig {
  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new Error(`Config file not found: ${absoluteConfigPath}`);
  }

  const configDir = path.dirname(absoluteConfigPath);
  const content = fs.readFileSync(absoluteConfigPath, 'utf-8');

  let parsed: JsonConfig;
  try {
    parsed = JSON.parse(content) as JsonConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON config: ${message}`);
  }

  const result: PartialServerConfig = {};

  if (parsed.ports) {
    if (parsed.ports.cdp !== undefined) {
      result.cdpPort = validatePort(parsed.ports.cdp, 'ports.cdp');
    }
    if (parsed.ports.http_mcp !== undefined) {
      result.httpMcpPort = validatePort(
        parsed.ports.http_mcp,
        'ports.http_mcp',
      );
    }
    if (parsed.ports.agent !== undefined) {
      result.agentPort = validatePort(parsed.ports.agent, 'ports.agent');
    }
    if (parsed.ports.extension !== undefined) {
      result.extensionPort = validatePort(
        parsed.ports.extension,
        'ports.extension',
      );
    }
  }

  if (parsed.directories) {
    if (parsed.directories.resources !== undefined) {
      result.resourcesDir = resolvePath(
        parsed.directories.resources,
        configDir,
      );
    }
    if (parsed.directories.execution !== undefined) {
      result.executionDir = resolvePath(
        parsed.directories.execution,
        configDir,
      );
    }
  }

  if (parsed.flags) {
    if (parsed.flags.allow_remote_in_mcp !== undefined) {
      if (typeof parsed.flags.allow_remote_in_mcp !== 'boolean') {
        throw new Error(
          `Invalid config: flags.allow_remote_in_mcp must be a boolean`,
        );
      }
      result.mcpAllowRemote = parsed.flags.allow_remote_in_mcp;
    }
  }

  if (parsed.instance) {
    if (parsed.instance.client_id) {
      if (typeof parsed.instance.client_id !== 'string') {
        throw new Error(`Invalid config: instance.client_id must be a string`);
      }
      result.instanceClientId = parsed.instance.client_id;
    }
    if (parsed.instance.install_id) {
      if (typeof parsed.instance.install_id !== 'string') {
        throw new Error(`Invalid config: instance.install_id must be a string`);
      }
      result.instanceInstallId = parsed.instance.install_id;
    }
    if (parsed.instance.browseros_version) {
      if (typeof parsed.instance.browseros_version !== 'string') {
        throw new Error(
          `Invalid config: instance.browseros_version must be a string`,
        );
      }
      result.instanceBrowserosVersion = parsed.instance.browseros_version;
    }
    if (parsed.instance.chromium_version) {
      if (typeof parsed.instance.chromium_version !== 'string') {
        throw new Error(
          `Invalid config: instance.chromium_version must be a string`,
        );
      }
      result.instanceChromiumVersion = parsed.instance.chromium_version;
    }
  }

  return result;
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
