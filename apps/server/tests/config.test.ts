/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {describe, it, beforeEach, afterEach} from 'bun:test';

import {loadServerConfig} from '../src/config.js';

describe('loadServerConfig', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browseros-config-test-'));
    originalEnv = {...process.env};

    // Clear relevant env vars
    delete process.env.CDP_PORT;
    delete process.env.HTTP_MCP_PORT;
    delete process.env.AGENT_PORT;
    delete process.env.EXTENSION_PORT;
    delete process.env.RESOURCES_DIR;
    delete process.env.EXECUTION_DIR;
  });

  afterEach(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
    process.env = originalEnv;
  });

  describe('CLI parsing', () => {
    it('parses all CLI args', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--cdp-port=9222',
        '--http-mcp-port=9223',
        '--agent-port=9225',
        '--extension-port=9224',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.cdpPort, 9222);
      assert.strictEqual(result.value.httpMcpPort, 9223);
      assert.strictEqual(result.value.agentPort, 9225);
      assert.strictEqual(result.value.extensionPort, 9224);
      assert.strictEqual(result.value.mcpAllowRemote, false);
    });

    it('parses --allow-remote-in-mcp flag', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--http-mcp-port=9223',
        '--agent-port=9225',
        '--extension-port=9224',
        '--allow-remote-in-mcp',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.mcpAllowRemote, true);
    });

    it('cdp-port is optional (nullable)', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--http-mcp-port=9223',
        '--agent-port=9225',
        '--extension-port=9224',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.cdpPort, null);
    });
  });

  describe('environment variables', () => {
    it('reads from env when CLI not provided', () => {
      const result = loadServerConfig(['bun', 'src/index.ts'], {
        CDP_PORT: '9222',
        HTTP_MCP_PORT: '9223',
        AGENT_PORT: '9225',
        EXTENSION_PORT: '9224',
      });

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.cdpPort, 9222);
      assert.strictEqual(result.value.httpMcpPort, 9223);
      assert.strictEqual(result.value.agentPort, 9225);
      assert.strictEqual(result.value.extensionPort, 9224);
    });

    it('CLI takes precedence over env', () => {
      const result = loadServerConfig(
        [
          'bun',
          'src/index.ts',
          '--http-mcp-port=1111',
          '--agent-port=2222',
          '--extension-port=3333',
        ],
        {
          HTTP_MCP_PORT: '9999',
          AGENT_PORT: '9999',
          EXTENSION_PORT: '9999',
        },
      );

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.httpMcpPort, 1111);
      assert.strictEqual(result.value.agentPort, 2222);
      assert.strictEqual(result.value.extensionPort, 3333);
    });
  });

  describe('config file loading', () => {
    it('loads config from --config path', () => {
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
          flags: {
            allow_remote_in_mcp: true,
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.cdpPort, 9222);
      assert.strictEqual(result.value.httpMcpPort, 3000);
      assert.strictEqual(result.value.agentPort, 3001);
      assert.strictEqual(result.value.extensionPort, 3002);
      assert.strictEqual(result.value.mcpAllowRemote, true);
    });

    it('CLI takes precedence over config file', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {
            http_mcp: 3000,
            agent: 3001,
            extension: 3002,
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
        '--http-mcp-port=9999',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.httpMcpPort, 9999);
      assert.strictEqual(result.value.agentPort, 3001);
    });

    it('config file takes precedence over env', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {
            http_mcp: 3000,
            agent: 3001,
            extension: 3002,
          },
        }),
      );

      const result = loadServerConfig(
        ['bun', 'src/index.ts', `--config=${configPath}`],
        {HTTP_MCP_PORT: '9999'},
      );

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.httpMcpPort, 3000);
    });

    it('resolves relative paths in config file', () => {
      const subdir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subdir);
      const configPath = path.join(subdir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {http_mcp: 3000, agent: 3001, extension: 3002},
          directories: {
            resources: '../data',
            execution: './logs',
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.resourcesDir, path.join(tempDir, 'data'));
      assert.strictEqual(result.value.executionDir, path.join(subdir, 'logs'));
    });

    it('loads instance metadata from config', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {http_mcp: 3000, agent: 3001, extension: 3002},
          instance: {
            client_id: 'user-123',
            install_id: 'install-456',
            browseros_version: '1.0.0',
            chromium_version: '120.0.0',
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.instanceClientId, 'user-123');
      assert.strictEqual(result.value.instanceInstallId, 'install-456');
      assert.strictEqual(result.value.instanceBrowserosVersion, '1.0.0');
      assert.strictEqual(result.value.instanceChromiumVersion, '120.0.0');
    });
  });

  describe('error handling (Result type)', () => {
    it('returns error for missing required ports', () => {
      const result = loadServerConfig(['bun', 'src/index.ts']);

      assert.strictEqual(result.ok, false);
      if (result.ok) return;
      assert.ok(result.error.includes('httpMcpPort'));
      assert.ok(result.error.includes('agentPort'));
      assert.ok(result.error.includes('extensionPort'));
    });

    it('returns error for missing config file', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--config=/nonexistent/config.json',
      ]);

      assert.strictEqual(result.ok, false);
      if (result.ok) return;
      assert.ok(result.error.includes('Config file not found'));
    });

    it('returns error for invalid JSON in config file', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(configPath, 'this is not valid json {{{');

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      assert.strictEqual(result.ok, false);
      if (result.ok) return;
      assert.ok(result.error.includes('Config file error'));
    });

    it('ignores invalid port types in config (Zod catches later)', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {
            http_mcp: 'not-a-number',
            agent: 3001,
            extension: 3002,
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      // Should fail Zod validation since http_mcp is invalid
      assert.strictEqual(result.ok, false);
      if (result.ok) return;
      assert.ok(result.error.includes('httpMcpPort'));
    });

    it('ignores invalid instance types (no strict validation)', () => {
      const configPath = path.join(tempDir, 'config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          ports: {http_mcp: 3000, agent: 3001, extension: 3002},
          instance: {
            client_id: 123, // should be string
            browseros_version: true, // should be string
          },
        }),
      );

      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        `--config=${configPath}`,
      ]);

      // Should succeed - invalid types are silently ignored
      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.instanceClientId, undefined);
      assert.strictEqual(result.value.instanceBrowserosVersion, undefined);
    });
  });

  describe('defaults', () => {
    it('uses cwd for resourcesDir and executionDir by default', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--http-mcp-port=3000',
        '--agent-port=3001',
        '--extension-port=3002',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.resourcesDir, process.cwd());
      assert.strictEqual(result.value.executionDir, process.cwd());
    });

    it('defaults mcpAllowRemote to false', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--http-mcp-port=3000',
        '--agent-port=3001',
        '--extension-port=3002',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.mcpAllowRemote, false);
    });

    it('defaults cdpPort to null', () => {
      const result = loadServerConfig([
        'bun',
        'src/index.ts',
        '--http-mcp-port=3000',
        '--agent-port=3001',
        '--extension-port=3002',
      ]);

      assert.strictEqual(result.ok, true);
      if (!result.ok) return;
      assert.strictEqual(result.value.cdpPort, null);
    });
  });
});
