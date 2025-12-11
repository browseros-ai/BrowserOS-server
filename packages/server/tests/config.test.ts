/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {describe, it, beforeEach, afterEach} from 'bun:test';

import {loadConfig} from '../src/config.js';

describe('config loading', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browseros-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
  });

  it('loads a valid JSON config with all fields', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        ports: {
          cdp: 9222,
          http_mcp: 3000,
          agent: 3001,
          extension: 3002,
        },
        directories: {
          resources: './resources',
          execution: './logs',
        },
        flags: {
          allow_remote_in_mcp: true,
        },
      }),
    );

    const config = loadConfig(configPath);

    assert.strictEqual(config.cdpPort, 9222);
    assert.strictEqual(config.httpMcpPort, 3000);
    assert.strictEqual(config.agentPort, 3001);
    assert.strictEqual(config.extensionPort, 3002);
    assert.strictEqual(config.resourcesDir, path.join(tempDir, 'resources'));
    assert.strictEqual(config.executionDir, path.join(tempDir, 'logs'));
    assert.strictEqual(config.mcpAllowRemote, true);
  });

  it('loads partial config (ports only)', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        ports: {
          http_mcp: 8080,
          agent: 8081,
          extension: 8082,
        },
      }),
    );

    const config = loadConfig(configPath);

    assert.strictEqual(config.cdpPort, undefined);
    assert.strictEqual(config.httpMcpPort, 8080);
    assert.strictEqual(config.agentPort, 8081);
    assert.strictEqual(config.extensionPort, 8082);
    assert.strictEqual(config.resourcesDir, undefined);
    assert.strictEqual(config.mcpAllowRemote, undefined);
  });

  it('resolves relative paths relative to config file', () => {
    const subdir = path.join(tempDir, 'subdir');
    fs.mkdirSync(subdir);
    const configPath = path.join(subdir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        directories: {
          resources: '../data',
          execution: './logs',
        },
      }),
    );

    const config = loadConfig(configPath);

    assert.strictEqual(config.resourcesDir, path.join(tempDir, 'data'));
    assert.strictEqual(config.executionDir, path.join(subdir, 'logs'));
  });

  it('handles absolute paths', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        directories: {
          resources: '/absolute/path/resources',
          execution: '/absolute/path/logs',
        },
      }),
    );

    const config = loadConfig(configPath);

    assert.strictEqual(config.resourcesDir, '/absolute/path/resources');
    assert.strictEqual(config.executionDir, '/absolute/path/logs');
  });

  it('throws on missing config file', () => {
    assert.throws(
      () => loadConfig('/nonexistent/config.json'),
      /Config file not found/,
    );
  });

  it('throws on invalid JSON syntax', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(configPath, 'this is not valid json {{{');

    assert.throws(() => loadConfig(configPath), /Failed to parse JSON/);
  });

  it('throws on invalid port (out of range)', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        ports: {
          http_mcp: 99999,
        },
      }),
    );

    assert.throws(() => loadConfig(configPath), /must be between 1 and 65535/);
  });

  it('throws on invalid port (not a number)', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        ports: {
          http_mcp: 'not-a-number',
        },
      }),
    );

    assert.throws(() => loadConfig(configPath), /must be an integer/);
  });

  it('throws on invalid allow_remote_in_mcp type', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        flags: {
          allow_remote_in_mcp: 'yes',
        },
      }),
    );

    assert.throws(() => loadConfig(configPath), /must be a boolean/);
  });

  it('loads empty config file', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(configPath, '{}');

    const config = loadConfig(configPath);

    assert.strictEqual(config.cdpPort, undefined);
    assert.strictEqual(config.httpMcpPort, undefined);
    assert.strictEqual(config.mcpAllowRemote, undefined);
  });

  it('loads instance config', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        instance: {
          client_id: 'user-123',
          install_id: 'install-456',
          browseros_version: '1.0.0',
          chromium_version: '120.0.0',
        },
      }),
    );

    const config = loadConfig(configPath);

    assert.strictEqual(config.instanceClientId, 'user-123');
    assert.strictEqual(config.instanceInstallId, 'install-456');
    assert.strictEqual(config.instanceBrowserosVersion, '1.0.0');
    assert.strictEqual(config.instanceChromiumVersion, '120.0.0');
  });

  it('throws on invalid instance client_id type', () => {
    const configPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        instance: {
          client_id: 123,
        },
      }),
    );

    assert.throws(() => loadConfig(configPath), /must be a string/);
  });
});
