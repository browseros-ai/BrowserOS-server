/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {logger} from '@browseros/common';
import {stringify} from 'smol-toml';

export interface McpServerConfig {
  url: string;
  startup_timeout_sec?: number;
  tool_timeout_sec?: number;
}

export interface BrowserOSCodexConfig {
  model_name: string;
  base_url: string;
  api_key_env: string;
  wire_api: 'chat' | 'responses';
  base_instructions_file: string;
  mcp_servers: {
    [key: string]: McpServerConfig;
  };
}

export function getResourcesDir(resourcesDir?: string): string {
  return resourcesDir || process.cwd();
}

export function generateBrowserOSCodexToml(
  config: BrowserOSCodexConfig,
): string {
  const header = [
    '# BrowserOS Model Provider Configuration',
    '# This file configures a custom model provider for Codex',
    '',
  ].join('\n');

  const tomlContent = stringify(config);

  return header + tomlContent;
}

export function writeBrowserOSCodexConfig(
  config: BrowserOSCodexConfig,
  outputDir: string,
): string {
  const tomlContent = generateBrowserOSCodexToml(config);
  const tomlPath = join(outputDir, 'browseros_config.toml');

  writeFileSync(tomlPath, tomlContent, 'utf-8');

  logger.info('✅ Generated BrowserOS Codex config', {
    path: tomlPath,
    modelName: config.model_name,
    baseUrl: config.base_url,
  });

  return tomlPath;
}

export function writePromptFile(
  promptContent: string,
  outputDir: string,
): string {
  const promptPath = join(outputDir, 'browseros_prompt.md');

  writeFileSync(promptPath, promptContent, 'utf-8');

  logger.info('✅ Generated BrowserOS prompt file', {
    path: promptPath,
    size: promptContent.length,
  });

  return promptPath;
}
