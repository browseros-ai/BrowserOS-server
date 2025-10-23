/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {query} from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as tar from 'tar';
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

import sdkArchive from './embedded-claude-sdk.tar.gz' with {type: 'file'};

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
  private tempDir: string | null = null;

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
    const isBunfsPath =
      sdkArchive.includes('$bunfs') || sdkArchive.includes('/bunfs/');

    if (!isBunfsPath && fs.existsSync(sdkArchive)) {
      const require = await import('node:module').then(m =>
        m.createRequire(import.meta.url),
      );
      this.cliPath = require.resolve('@anthropic-ai/claude-agent-sdk/cli.js');
      logger.info('✅ Using Claude Code CLI from node_modules', {
        path: this.cliPath,
      });
      return;
    }

    const version = process.env.BROWSEROS_VERSION || 'unkown';
    this.tempDir = path.join(os.tmpdir(), `browseros-sdk-${version}`);
    this.cliPath = path.join(this.tempDir, 'claude-agent-sdk/cli.js');

    if (fs.existsSync(this.cliPath)) {
      logger.info('✅ Using cached SDK from temp directory', {
        version,
        path: this.cliPath,
      });
      return;
    }

    try {
      await fs.promises.mkdir(this.tempDir, {recursive: true});

      const archiveContent = await Bun.file(sdkArchive).arrayBuffer();
      const archivePath = path.join(this.tempDir, 'sdk.tar.gz');
      await fs.promises.writeFile(archivePath, new Uint8Array(archiveContent));

      await tar.x({
        file: archivePath,
        cwd: this.tempDir,
        strict: true,
      });

      await fs.promises.chmod(this.cliPath, 0o755);

      logger.info('✅ Extracted embedded Claude SDK from archive', {
        version,
        path: this.cliPath,
      });
    } catch (error) {
      throw new Error(
        '❌ Failed to extract Claude SDK.\n' +
          `Error: ${error instanceof Error ? error.message : String(error)}\n` +
          'Ensure sufficient disk space and write permissions.',
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
   * Note: Does NOT delete cached SDK directory (reused across restarts).
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
