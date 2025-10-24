/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {query} from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {EventFormatter, FormattedEvent} from '../utils/EventFormatter.js';
import {
  logger,
  fetchBrowserOSConfig,
  type BrowserOSConfig,
} from '@browseros/common';
import type {AgentConfig} from './types.js';
import {BaseAgent} from './BaseAgent.js';
import {CLAUDE_SDK_SYSTEM_PROMPT} from './ClaudeSDKAgent.prompt.js';
import {allControllerTools} from '@browseros/tools/controller-based';
import type {ToolDefinition} from '@browseros/tools';
import {
  ControllerBridge,
  ControllerContext,
} from '@browseros/controller-server';
import {createControllerMcpServer} from './ControllerToolsAdapter.js';

const CLAUDE_CLI_CDN = 'https://cdn.browseros.com/cli';

/**
 * Claude SDK specific default configuration
 */
const CLAUDE_SDK_DEFAULTS = {
  maxTurns: 100,
  maxThinkingTokens: 10000,
  permissionMode: 'bypassPermissions' as const,
};

/**
 * Claude SDK Agent implementation
 *
 * Wraps @anthropic-ai/claude-agent-sdk with:
 * - In-process SDK MCP server with controller tools
 * - Shared ControllerBridge for browseros-controller connection
 * - Event formatting via EventFormatter
 * - AbortController for cleanup
 * - Metadata tracking
 *
 * Note: Requires external ControllerBridge (provided by main server)
 */
export class ClaudeSDKAgent extends BaseAgent {
  private abortController: AbortController | null = null;
  private gatewayConfig: BrowserOSConfig | null = null;
  private cliPath!: string;

  constructor(config: AgentConfig, controllerBridge: ControllerBridge) {
    logger.info('🔧 Using shared ControllerBridge for controller connection');

    const controllerContext = new ControllerContext(controllerBridge);

    // Get all controller tools from package and create SDK MCP server
    const sdkMcpServer = createControllerMcpServer(
      allControllerTools,
      controllerContext,
    );

    logger.info(
      `✅ Created SDK MCP server with ${allControllerTools.length} controller tools`,
    );

    // Pass Claude SDK specific defaults to BaseAgent (must call super before accessing this)
    super('claude-sdk', config, {
      systemPrompt: CLAUDE_SDK_SYSTEM_PROMPT,
      mcpServers: {'browseros-controller': sdkMcpServer},
      maxTurns: CLAUDE_SDK_DEFAULTS.maxTurns,
      maxThinkingTokens: CLAUDE_SDK_DEFAULTS.maxThinkingTokens,
      permissionMode: CLAUDE_SDK_DEFAULTS.permissionMode,
    });

    logger.info('✅ ClaudeSDKAgent initialized with shared ControllerBridge');
  }

  /**
   * Initialize agent - fetch config from BrowserOS Config URL
   */
  override async init(): Promise<void> {
    await this.setupClaudeSdk();
    await this.loadApiKey();
    await super.init();
  }

  private async setupClaudeSdk(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      const require = await import('node:module').then(m =>
        m.createRequire(import.meta.url),
      );
      this.cliPath = require.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
      logger.info('✅ Using Claude Code CLI from node_modules (dev mode)', {
        path: this.cliPath,
      });
      return;
    }

    const version = process.env.BROWSEROS_VERSION || 'unknown';
    const platform = this.detectPlatform();
    const cacheDir = path.join(os.tmpdir(), `browseros-sdk-${version}`);
    this.cliPath = path.join(cacheDir, 'claude');

    if (fs.existsSync(this.cliPath)) {
      logger.info('✅ Using cached Claude CLI binary', {
        version,
        platform,
        path: this.cliPath,
      });
      return;
    }

    logger.info('📥 Downloading Claude CLI binary', {version, platform});
    await this.downloadClaudeBinary(platform, cacheDir);
    logger.info('✅ Downloaded Claude CLI binary', {path: this.cliPath});
  }

  private detectPlatform(): string {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'darwin' && arch === 'arm64')
      return 'claude-cli-darwin-arm64';
    if (platform === 'darwin' && arch === 'x64')
      return 'claude-cli-darwin-x64';
    if (platform === 'linux' && arch === 'x64') return 'claude-cli-linux-x64';
    if (platform === 'linux' && arch === 'arm64')
      return 'claude-cli-linux-arm64';
    if (platform === 'win32' && arch === 'x64')
      return 'claude-cli-windows-x64.exe';

    throw new Error(
      `Unsupported platform: ${platform}-${arch}. Supported platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64`,
    );
  }

  private async downloadClaudeBinary(
    platform: string,
    cacheDir: string,
  ): Promise<void> {
    const url = `${CLAUDE_CLI_CDN}/${platform}`;

    try {
      await fs.promises.mkdir(cacheDir, {recursive: true});

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      await fs.promises.writeFile(this.cliPath, new Uint8Array(arrayBuffer));
      await fs.promises.chmod(this.cliPath, 0o755);
    } catch (error) {
      throw new Error(
        `❌ Failed to download Claude CLI from ${url}\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async loadApiKey(): Promise<void> {
    const configUrl = process.env.BROWSEROS_CONFIG_URL;

    if (configUrl) {
      logger.info('🌐 Fetching config from BrowserOS Config URL', {configUrl});

      try {
        this.gatewayConfig = await fetchBrowserOSConfig(configUrl);
        this.config.apiKey = this.gatewayConfig.apiKey;
        logger.info('✅ Using API key from BrowserOS Config URL', {
          model: this.gatewayConfig.model,
        });
        return;
      } catch (error) {
        logger.warn(
          '⚠️  Failed to fetch from config URL, falling back to ANTHROPIC_API_KEY',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    const envApiKey = process.env.ANTHROPIC_API_KEY;
    if (envApiKey) {
      this.config.apiKey = envApiKey;
      logger.info('✅ Using API key from ANTHROPIC_API_KEY env var');
      return;
    }

    throw new Error(
      'No API key found. Set either BROWSEROS_CONFIG_URL or ANTHROPIC_API_KEY',
    );
  }

  /**
   * Execute a task using Claude SDK and stream formatted events
   *
   * @param message - User's natural language request
   * @yields FormattedEvent instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    if (!this.initialized) {
      await this.init();
    }

    this.startExecution();
    this.abortController = new AbortController();

    logger.info('🤖 ClaudeSDKAgent executing', {
      message: message.substring(0, 100),
    });

    try {
      const options: any = {
        apiKey: this.config.apiKey,
        maxTurns: this.config.maxTurns,
        maxThinkingTokens: this.config.maxThinkingTokens,
        cwd: this.config.cwd,
        systemPrompt: this.config.systemPrompt,
        mcpServers: this.config.mcpServers,
        permissionMode: this.config.permissionMode,
        abortController: this.abortController,
        pathToClaudeCodeExecutable: this.cliPath,
      };

      if (process.env.NODE_ENV === 'development') {
        options.executable = 'bun';
      }

      if (this.gatewayConfig?.model) {
        options.model = this.gatewayConfig.model;
        logger.debug('Using model from gateway', {
          model: this.gatewayConfig.model,
        });
      }

      // Call Claude SDK
      const iterator = query({prompt: message, options})[
        Symbol.asyncIterator
      ]();

      // Stream events
      while (true) {
        const result = await iterator.next();
        if (result.done) break;

        const event = result.value;

        // Update event time
        this.updateEventTime();

        // Track tool executions (check for assistant message with tool_use content)
        if (event.type === 'assistant' && (event as any).message?.content) {
          const toolUses = (event as any).message.content.filter(
            (c: any) => c.type === 'tool_use',
          );
          if (toolUses.length > 0) {
            this.updateToolsExecuted(toolUses.length);
          }
        }

        // Track turn count from result events
        if (event.type === 'result') {
          const numTurns = (event as any).num_turns;
          if (numTurns) {
            this.updateTurns(numTurns);
          }

          // Log raw result events for debugging
          logger.info('📊 Raw result event', {
            subtype: (event as any).subtype,
            is_error: (event as any).is_error,
            num_turns: numTurns,
            result: (event as any).result
              ? typeof (event as any).result === 'string'
                ? (event as any).result.substring(0, 200)
                : JSON.stringify((event as any).result).substring(0, 200)
              : 'N/A',
          });
        }

        // Format the event using EventFormatter
        const formattedEvent = EventFormatter.format(event);

        // Yield formatted event if valid
        if (formattedEvent) {
          logger.debug('📤 ClaudeSDKAgent yielding event', {
            type: formattedEvent.type,
          });
          yield formattedEvent;
        }
      }

      // Complete execution tracking
      this.completeExecution();

      logger.info('✅ ClaudeSDKAgent execution complete', {
        turns: this.metadata.turns,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime,
      });
    } catch (error) {
      // Mark execution error
      this.errorExecution(
        error instanceof Error ? error : new Error(String(error)),
      );

      logger.error('❌ ClaudeSDKAgent execution failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    } finally {
      // Clear AbortController reference
      this.abortController = null;
    }
  }

  /**
   * Cleanup agent resources
   *
   * Aborts the running SDK query. Does NOT close shared ControllerBridge.
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) {
      logger.debug('⚠️  ClaudeSDKAgent already destroyed');
      return;
    }

    this.markDestroyed();

    if (this.abortController) {
      logger.debug('🛑 Aborting SDK query');
      this.abortController.abort();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.debug('🗑️  ClaudeSDKAgent destroyed', {
      totalDuration: this.metadata.totalDuration,
      turns: this.metadata.turns,
      toolsExecuted: this.metadata.toolsExecuted,
    });
  }
}
