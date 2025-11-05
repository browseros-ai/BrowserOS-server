/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {accessSync, constants as fsConstants} from 'node:fs';
import {dirname, join} from 'node:path';

import {Codex, Thread, type McpServerConfig} from '@browseros/codex-sdk-ts';
import {logger} from '@browseros/common';
import type {ControllerBridge} from '@browseros/controller-server';
import {allControllerTools} from '@browseros/tools/controller-based';

import {AGENT_SYSTEM_PROMPT} from './Agent.prompt.js';
import {BaseAgent} from './BaseAgent.js';
import {CodexEventFormatter} from './CodexSDKAgent.formatter.js';
import {
  type BrowserOSCodexConfig,
  getResourcesDir,
  writeBrowserOSCodexConfig,
  writePromptFile,
} from './CodexSDKAgent.config.js';
import {type AgentConfig, FormattedEvent} from './types.js';

/**
 * Codex SDK specific default configuration
 */
const CODEX_SDK_DEFAULTS = {
  maxTurns: 100,
  mcpServerHost: '127.0.0.1',
  mcpServerPort: 9100,
} as const;

/**
 * Build MCP server configuration from agent config
 */
function buildMcpServerConfig(config: AgentConfig): McpServerConfig {
  const port = config.mcpServerPort || CODEX_SDK_DEFAULTS.mcpServerPort;
  const mcpServerUrl = `http://${CODEX_SDK_DEFAULTS.mcpServerHost}:${port}/mcp`;
  return {url: mcpServerUrl} as McpServerConfig;
}

/**
 * Codex SDK Agent implementation
 *
 * Wraps @openai/codex-sdk with:
 * - In-process SDK MCP server with controller tools
 * - Shared ControllerBridge for browseros-controller connection
 * - Event formatting via EventFormatter (Codex → FormattedEvent)
 * - Break-loop abort pattern (Codex has no native abort)
 * - Heartbeat mechanism for long-running operations
 * - Thread-based execution model
 * - Metadata tracking
 *
 * Environment Variables:
 * - CODEX_BINARY_PATH: Optional override when no bundled codex binary is found
 *
 * Configuration (via AgentConfig):
 * - resourcesDir: Resources directory (required)
 * - mcpServerPort: MCP server port (optional, defaults to 9100)
 * - apiKey: OpenAI API key (required)
 * - baseUrl: Custom LLM endpoint (optional)
 * - modelName: Model to use (optional, defaults to 'o4-mini')
 */
export class CodexSDKAgent extends BaseAgent {
  private abortController: AbortController | null = null;
  private codex: Codex | null = null;
  private codexExecutablePath: string | null = null;
  private codexConfigPath: string | null = null;
  private currentThread: Thread | null = null;

  constructor(config: AgentConfig, _controllerBridge: ControllerBridge) {
    const mcpServerConfig = buildMcpServerConfig(config);

    logger.info('🔧 CodexSDKAgent initializing', {
      mcpServerUrl: mcpServerConfig.url,
      toolCount: allControllerTools.length,
    });

    super('codex-sdk', config, {
      systemPrompt: AGENT_SYSTEM_PROMPT,
      mcpServers: {'browseros-mcp': mcpServerConfig},
      maxTurns: CODEX_SDK_DEFAULTS.maxTurns,
    });

    logger.info('✅ CodexSDKAgent initialized successfully');
  }

  /**
   * Initialize agent - use config passed in constructor
   */
  override async init(): Promise<void> {
    this.codexExecutablePath = this.resolveCodexExecutablePath();

    logger.info('🚀 Resolved Codex binary path', {
      codexExecutablePath: this.codexExecutablePath,
    });

    if (!this.config.apiKey) {
      throw new Error('API key is required in AgentConfig');
    }

    logger.info('✅ Using config from AgentConfig', {
      model: this.config.modelName,
    });

    await super.init();
    this.generateCodexConfig();
    this.initializeCodex();
  }

  private generateCodexConfig(): void {
    const outputDir = getResourcesDir(this.config.executionDir);
    const port = this.config.mcpServerPort || CODEX_SDK_DEFAULTS.mcpServerPort;
    const modelName = this.config.modelName || 'o4-mini';
    const baseUrl = this.config.baseUrl;

    const codexConfig: BrowserOSCodexConfig = {
      model_name: modelName,
      base_url: baseUrl,
      api_key_env: 'BROWSEROS_API_KEY',
      wire_api: 'chat',
      base_instructions_file: 'browseros_prompt.md',
      mcp_servers: {
        browseros: {
          url: `http://127.0.0.1:${port}/mcp`,
          startup_timeout_sec: 30.0,
          tool_timeout_sec: 120.0,
        },
      },
    };

    writePromptFile(AGENT_SYSTEM_PROMPT, outputDir);
    this.codexConfigPath = writeBrowserOSCodexConfig(codexConfig, outputDir);

    logger.info('✅ Generated Codex configuration files', {
      outputDir,
      configPath: this.codexConfigPath,
      modelName,
      baseUrl,
    });
  }

  private initializeCodex(): void {
    const codexConfig: any = {
      codexPathOverride: this.codexExecutablePath,
      apiKey: this.config.apiKey,
      // Note: baseUrl is not passed here because when using browseros config,
      // it's already specified in the TOML file (base_url field)
    };

    this.codex = new Codex(codexConfig);

    logger.info('✅ Codex SDK initialized', {
      binaryPath: this.codexExecutablePath,
    });
  }

  private resolveCodexExecutablePath(): string {
    const codexBinaryName =
      process.platform === 'win32' ? 'codex.exe' : 'codex';

     // 1. Check CODEX_BINARY_PATH env var
     if (process.env.CODEX_BINARY_PATH) {
      return process.env.CODEX_BINARY_PATH;
    }

    // 2. Check resourcesDir if provided
    if (this.config.resourcesDir) {
      const resourcesCodexPath = join(
        this.config.resourcesDir,
        'bin',
        codexBinaryName,
      );
      try {
        accessSync(resourcesCodexPath, fsConstants.X_OK);
        return resourcesCodexPath;
      } catch {
        // Ignore failures; fall back to next option
      }
    }

    // 3. Check bundled codex in current binary directory
    const currentBinaryDirectory = dirname(process.execPath);
    const bundledCodexPath = join(currentBinaryDirectory, codexBinaryName);
    try {
      accessSync(bundledCodexPath, fsConstants.X_OK);
      return bundledCodexPath;
    } catch {
      // Ignore failures; fall back to env var
    }

    throw new Error(
      'Codex binary not found. Set --resources-dir or CODEX_BINARY_PATH',
    );
  }

  /**
   * Wrapper around iterator.next() that yields heartbeat events while waiting
   * @param iterator - The async iterator
   * @yields Heartbeat events (FormattedEvent) while waiting, then the final iterator result (IteratorResult)
   */
  private async *nextWithHeartbeat(
    iterator: AsyncIterator<any>,
  ): AsyncGenerator<any> {
    const heartbeatInterval = 20000; // 20 seconds
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let abortHandler: (() => void) | null = null;

    // Call iterator.next() once - this generator wraps a single next() call
    const iteratorPromise = iterator.next();

    // Create abort promise
    const abortPromise = new Promise<never>((_, reject) => {
      if (this.abortController) {
        abortHandler = () => {
          reject(new Error('Agent execution aborted by client'));
        };
        this.abortController.signal.addEventListener('abort', abortHandler, {
          once: true,
        });
      }
    });

    try {
      // Loop until the iterator promise resolves, yielding heartbeats while waiting
      while (true) {
        // Check if execution was aborted
        if (this.abortController?.signal.aborted) {
          logger.info('⚠️  Agent execution aborted during heartbeat wait');
          return;
        }

        // Create timeout promise for this iteration
        const timeoutPromise = new Promise(resolve => {
          heartbeatTimer = setTimeout(
            () => resolve({type: 'heartbeat'}),
            heartbeatInterval,
          );
        });

        type RaceResult = {type: 'result'; result: any} | {type: 'heartbeat'};
        let race: RaceResult;

        try {
          race = await Promise.race([
            iteratorPromise.then(result => ({type: 'result' as const, result})),
            timeoutPromise.then(() => ({type: 'heartbeat' as const})),
            abortPromise,
          ]);
        } catch (abortError) {
          // Abort was triggered during wait
          logger.info(
            '⚠️  Agent execution aborted (caught during iterator wait)',
          );
          // Break loop to stop iteration (Codex has no native abort)
          return;
        }

        // Clear the timeout if it was set
        if (heartbeatTimer) {
          clearTimeout(heartbeatTimer);
          heartbeatTimer = null;
        }

        if (race.type === 'heartbeat') {
          // Heartbeat timeout occurred - yield processing event and continue waiting
          yield CodexEventFormatter.createProcessingEvent();
          // Loop continues - will race the same iteratorPromise (still pending) vs new timeout
        } else {
          // Iterator result arrived - yield it and exit this generator
          yield race.result;
          return;
        }
      }
    } finally {
      // Clean up heartbeat timer
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
      }

      // Clean up abort listener if it wasn't triggered
      if (
        abortHandler &&
        this.abortController &&
        !this.abortController.signal.aborted
      ) {
        this.abortController.signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Execute a task using Codex SDK and stream formatted events
   *
   * @param message - User's natural language request
   * @yields FormattedEvent instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.codex) {
      throw new Error('Codex instance not initialized');
    }

    this.startExecution();
    this.abortController = new AbortController();

    logger.info('🤖 CodexSDKAgent executing', {
      message: message.substring(0, 100),
    });

    try {
      logger.debug('🔧 MCP Servers configured', {
        count: Object.keys(this.config.mcpServers || {}).length,
        servers: Object.keys(this.config.mcpServers || {}),
      });

      // Start thread with browseros config or MCP servers
      const modelName = this.config.modelName;
      const threadOptions: any = {
        skipGitRepoCheck: true,
        workingDirectory: this.config.executionDir,
      };

      // Use TOML config if available, otherwise fall back to direct MCP server config
      if (this.codexConfigPath) {
        threadOptions.browserosConfigPath = this.codexConfigPath;
        logger.debug('📡 Starting Codex thread with browseros config', {
          configPath: this.codexConfigPath,
        });
      } else {
        threadOptions.mcpServers = this.config.mcpServers;
        threadOptions.model = modelName;
        logger.debug('📡 Starting Codex thread with MCP servers', {
          mcpServerCount: Object.keys(this.config.mcpServers || {}).length,
          model: modelName,
        });
      }

      // Reuse existing thread for follow-up messages, or create new one
      // CRITICAL: Check both existence AND thread ID (ID is null if cancelled before thread.started event)
      if (!this.currentThread || !this.currentThread.id) {
        this.currentThread = this.codex.startThread(threadOptions);
        logger.info('🆕 Created new thread for session');
      } else {
        logger.info('♻️  Reusing existing thread for follow-up message', {
          threadId: this.currentThread.id,
        });
      }
      const thread = this.currentThread;

      // Get streaming events from thread
      const messages: Array<{type: 'text'; text: string}> = [];

      // When using TOML config, system prompt comes from base_instructions_file
      // Otherwise, add it as first message
      if (!this.codexConfigPath && this.config.systemPrompt) {
        messages.push({type: 'text' as const, text: this.config.systemPrompt});
      }

      // Add user message
      messages.push({type: 'text' as const, text: message});

      const {events} = await thread.runStreamed(messages);

      // Create iterator for streaming
      const iterator = events[Symbol.asyncIterator]();

      // Track last agent message for completion
      let lastAgentMessage: string | null = null;

      try {
        // Stream events with heartbeat and abort handling
        while (true) {
          // Check if execution was aborted (break-loop pattern)
          if (this.abortController?.signal.aborted) {
            logger.info(
              '⚠️  Agent execution aborted by client (breaking loop)',
            );
            // Clear thread - next message will create fresh thread
            this.currentThread = null;
            logger.debug('🔄 Cleared thread reference due to abort');
            break;
          }

          let result: IteratorResult<any> | null = null;

          // Iterate through heartbeat generator to get the actual result
          for await (const item of this.nextWithHeartbeat(iterator)) {
            if (item && item.done !== undefined) {
              // This is the final result
              result = item;
            } else {
              // This is a heartbeat/processing event - update time to prevent timeout
              this.updateEventTime();
              yield item;
            }
          }

          if (!result || result.done) break;

          const event = result.value;

          // Log Codex events for debugging
          const eventData = JSON.stringify(event).substring(0, 100);
          if (event.type === 'error' || event.type === 'turn.failed') {
            logger.error('Codex event', {type: event.type, data: eventData});
          } else {
            logger.debug('Codex event', {type: event.type, data: eventData});
          }

          // Update event time
          this.updateEventTime();

          // Track last agent_message for completion
          if (
            event.type === 'item.completed' &&
            event.item?.type === 'agent_message'
          ) {
            lastAgentMessage = event.item.text || null;
          }

          // Track tool executions from item.completed events with mcp_tool_call type
          if (
            event.type === 'item.completed' &&
            event.item?.type === 'mcp_tool_call' &&
            event.item.status === 'completed'
          ) {
            this.updateToolsExecuted(1);
          }

          // Handle turn completion - re-emit last agent message as completion
          if (event.type === 'turn.completed') {
            this.updateTurns(1);

            // Log usage statistics
            if (event.usage) {
              logger.info('📊 Turn completed', {
                inputTokens: event.usage.input_tokens,
                cachedInputTokens: event.usage.cached_input_tokens,
                outputTokens: event.usage.output_tokens,
              });
            }

            // Re-emit last agent message as completion event
            if (lastAgentMessage) {
              logger.info('✅ Emitting final completion message');
              yield new FormattedEvent('completion', lastAgentMessage);
            }

            // Break the loop - turn is complete
            break;
          }

          // Format the event using CodexEventFormatter
          const formattedEvent = CodexEventFormatter.format(event);

          // Yield formatted event if valid
          if (formattedEvent) {
            logger.debug('📤 CodexSDKAgent yielding event', {
              type: formattedEvent.type,
              originalType: event.type,
            });
            yield formattedEvent;
          }
        }
      } finally {
        // CRITICAL: Close iterator to trigger SIGKILL in forked SDK's finally block
        // Fire-and-forget to avoid blocking markIdle() - subprocess cleanup can happen async
        if (iterator.return) {
          logger.debug('🔒 Closing iterator to terminate Codex subprocess');
          iterator.return(undefined).catch((error) => {
            logger.warn('⚠️  Iterator cleanup error (non-fatal)', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      }

      // Complete execution tracking
      this.completeExecution();

      logger.info('✅ CodexSDKAgent execution complete', {
        turns: this.metadata.turns,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime,
      });
    } catch (error) {
      // Clear thread on error - next call will create fresh thread
      this.currentThread = null;
      logger.debug('🔄 Cleared thread reference due to error');

      // Mark execution error
      this.errorExecution(
        error instanceof Error ? error : new Error(String(error)),
      );

      logger.error('❌ CodexSDKAgent execution failed', {
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
   * Abort current execution
   * Triggers abort signal to stop the current task gracefully
   */
  abort(): void {
    if (this.abortController) {
      logger.info('🛑 Aborting CodexSDKAgent execution');
      this.abortController.abort();
    }
  }

  /**
   * Check if agent is currently executing
   */
  isExecuting(): boolean {
    return this.metadata.state === 'executing' && this.abortController !== null;
  }

  /**
   * Cleanup agent resources
   *
   * Immediately kills the Codex subprocess using SIGKILL.
   * Does NOT close shared ControllerBridge.
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) {
      logger.debug('⚠️  CodexSDKAgent already destroyed');
      return;
    }

    this.markDestroyed();

    // Clear thread reference
    this.currentThread = null;

    // Trigger abort controller for cleanup
    if (this.abortController) {
      this.abortController.abort();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // DO NOT close ControllerBridge - it's shared and owned by main server

    logger.debug('🗑️  CodexSDKAgent destroyed', {
      totalDuration: this.metadata.totalDuration,
      turns: this.metadata.turns,
      toolsExecuted: this.metadata.toolsExecuted,
    });
  }
}
