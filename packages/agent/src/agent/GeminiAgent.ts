/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {
  Config as GeminiConfig,
  MCPServerConfig,
  AuthType,
  GeminiEventType,
  executeToolCall,
  DEFAULT_GEMINI_FLASH_MODEL,
  type GeminiClient,
} from '@google/gemini-cli-core';
import {
  logger,
  fetchBrowserOSConfig,
  type BrowserOSConfig,
  type Provider,
} from '@browseros/common';
import type {ControllerBridge} from '@browseros/controller-server';

import {AGENT_SYSTEM_PROMPT} from './Agent.prompt.js';
import {BaseAgent} from './BaseAgent.js';
import {GeminiEventFormatter} from './GeminiAgent.formatter.js';
import {type AgentConfig, FormattedEvent} from './types.js';

const GEMINI_AGENT_DEFAULTS = {
  maxTurns: 100,
  maxThinkingTokens: 10000,
};

/**
 * Gemini CLI Agent implementation
 *
 * Wraps @google/gemini-cli-core with:
 * - Remote MCP server connection (via HTTP)
 * - Multi-turn conversation loop with tool execution
 * - Event formatting via GeminiEventFormatter
 * - AbortController for cleanup
 * - Metadata tracking
 */
export class GeminiAgent extends BaseAgent {
  private abortController: AbortController | null = null;
  private geminiConfig: GeminiConfig | null = null;
  private geminiClient: GeminiClient | null = null;
  private gatewayConfig: BrowserOSConfig | null = null;
  private selectedProvider: Provider | null = null;
  private promptId: string = '';

  constructor(config: AgentConfig, controllerBridge: ControllerBridge) {
    logger.info('🔧 GeminiAgent using remote MCP connection');

    super('gemini-sdk', config, {
      systemPrompt: AGENT_SYSTEM_PROMPT,
      maxTurns: GEMINI_AGENT_DEFAULTS.maxTurns,
      maxThinkingTokens: GEMINI_AGENT_DEFAULTS.maxThinkingTokens,
    });

    logger.info('✅ GeminiAgent initialized');
  }

  /**
   * Initialize agent - fetch config from BrowserOS Config URL if configured
   * Falls back to GEMINI_API_KEY env var if config URL not set or fails
   */
  override async init(): Promise<void> {
    const envApiKey = process.env.GEMINI_API_KEY;
    if (envApiKey) {
      this.config.apiKey = envApiKey;
      logger.info('✅ Using API key from GEMINI_API_KEY env var');
      await this.initializeGeminiClient();
      await super.init();
      return;
    }
    
    const configUrl = process.env.BROWSEROS_CONFIG_URL;

    if (configUrl) {
      logger.info('🌐 Fetching config from BrowserOS Config URL', {configUrl});

      try {
        this.gatewayConfig = await fetchBrowserOSConfig(configUrl);
        this.selectedProvider =
          this.gatewayConfig.providers.find(
            p => p.name === 'google' || p.name === 'gemini',
          ) || null;

        if (!this.selectedProvider) {
          throw new Error('No google/gemini provider found in config');
        }

        this.config.apiKey = this.selectedProvider.apiKey;
        if (this.selectedProvider.baseUrl) {
          this.config.baseUrl = this.selectedProvider.baseUrl;
        }
        if (this.selectedProvider.model) {
          this.config.modelName = this.selectedProvider.model;
        }

        logger.info('✅ Using config from BrowserOS Config URL', {
          model: this.config.modelName,
          baseUrl: this.config.baseUrl,
        });

        await this.initializeGeminiClient();
        await super.init();
        return;
      } catch (error) {
        logger.warn(
          '⚠️  Failed to fetch from config URL, falling back to GEMINI_API_KEY',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    throw new Error(
      'No API key found. Set either BROWSEROS_CONFIG_URL or GEMINI_API_KEY',
    );
  }

  /**
   * Initialize Gemini Config and Client
   */
  private async initializeGeminiClient(): Promise<void> {
    const mcpServerPort = this.config.mcpServerPort || 9100;
    const sessionId = `gemini-${Date.now()}`;

    this.geminiConfig = new GeminiConfig({
      sessionId,
      targetDir: this.config.executionDir,
      cwd: this.config.executionDir,
      debugMode: false,
      model: DEFAULT_GEMINI_FLASH_MODEL,
      mcpServers: {
        'browseros-mcp': new MCPServerConfig(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          `http://127.0.0.1:${mcpServerPort}/mcp`,
          {'Accept': 'application/json, text/event-stream'},
          undefined,
          undefined,
          true,
        ),
      },
    });

    await this.geminiConfig.initialize();

    if (this.config.apiKey) {
      process.env.GEMINI_API_KEY = this.config.apiKey;
    }

    await this.geminiConfig.refreshAuth(AuthType.USE_GEMINI);

    this.geminiClient = this.geminiConfig.getGeminiClient();

    if (this.config.systemPrompt) {
      this.geminiClient
        .getChat()
        .setSystemInstruction(this.config.systemPrompt);
    }

    this.promptId = `prompt-${Date.now()}`;

    logger.info('✅ GeminiClient initialized', {
      model: DEFAULT_GEMINI_FLASH_MODEL,
      mcpPort: mcpServerPort,
    });
  }

  /**
   * Execute a task using Gemini CLI and stream formatted events
   *
   * @param message - User's natural language request
   * @yields Formatteint instances
   */
  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.geminiClient || !this.geminiConfig) {
      throw new Error('GeminiClient not initialized');
    }

    this.startExecution();
    this.abortController = new AbortController();

    logger.info('🤖 GeminiAgent executing', {message});

    try {
      yield new FormattedEvent('init', 'Starting execution with Gemini');

      let currentMessages: any[] = [{role: 'user', parts: [{text: message}]}];
      let turnCount = 0;
      const maxTurns = this.config.maxTurns || GEMINI_AGENT_DEFAULTS.maxTurns;

      while (true) {
        turnCount++;
        logger.debug(`🔄 Turn ${turnCount}`);

        if (turnCount > maxTurns) {
          logger.warn('⚠️  Max turns exceeded');
          yield new FormattedEvent(
            'error',
            `Maximum turns reached (${maxTurns})`,
            {isError: true},
          );
          break;
        }

        const toolCallRequests: any[] = [];
        const formatter = new GeminiEventFormatter();

        const responseStream = this.geminiClient.sendMessageStream(
          currentMessages[0]?.parts || [],
          this.abortController.signal,
          this.promptId,
        );

        for await (const event of responseStream) {
          if (this.abortController.signal.aborted) {
            logger.info('⚠️  Agent execution aborted');
            return;
          }

          this.updateEventTime();

          const formatted = formatter.format(event);

          if (formatted) {
            const eventsToYield = Array.isArray(formatted)
              ? formatted
              : [formatted];

            for (const evt of eventsToYield) {
              logger.debug('📤 GeminiAgent yielding event', {type: evt.type});
              yield evt;
            }
          }

          if (event.type === GeminiEventType.ToolCallRequest) {
            toolCallRequests.push(event.value);
          }

          if (event.type === GeminiEventType.Error) {
            const error = event.value?.error;
            if (error) {
              if (error instanceof Error) {
                throw error;
              } else if (typeof error === 'object' && error.message) {
                throw new Error(error.message);
              } else if (typeof error === 'string') {
                throw new Error(error);
              } else {
                throw new Error(JSON.stringify(error));
              }
            }
            throw new Error('Unknown error occurred');
          }
        }

        if (toolCallRequests.length > 0) {
          logger.info(
            `🔧 Executing ${toolCallRequests.length} tool(s) in turn ${turnCount}`,
          );

          this.updateToolsExecuted(toolCallRequests.length);

          const toolResponseParts: any[] = [];
          const completedToolCalls: any[] = [];

          for (const requestInfo of toolCallRequests) {
            try {
              const completedToolCall = await executeToolCall(
                this.geminiConfig,
                requestInfo,
                this.abortController.signal,
              );

              const toolResponse = completedToolCall.response;
              completedToolCalls.push(completedToolCall);

              if (toolResponse.error) {
                logger.warn(`❌ Tool ${requestInfo.name} failed`, {
                  error: toolResponse.error.message,
                });
                yield GeminiEventFormatter.createToolResultEvent(
                  requestInfo.name,
                  false,
                  toolResponse.error.message,
                );
              } else {
                logger.debug(`✅ Tool ${requestInfo.name} succeeded`);
                yield GeminiEventFormatter.createToolResultEvent(
                  requestInfo.name,
                  true,
                );
              }

              if (toolResponse.responseParts) {
                toolResponseParts.push(...toolResponse.responseParts);
              }
            } catch (error) {
              const errorMsg =
                error instanceof Error ? error.message : String(error);
              logger.error(`❌ Tool execution failed: ${errorMsg}`);
              yield GeminiEventFormatter.createToolResultEvent(
                requestInfo.name,
                false,
                errorMsg,
              );
            }
          }

          try {
            const currentModel =
              this.geminiClient.getCurrentSequenceModel() ??
              this.geminiConfig.getModel();
            this.geminiClient
              .getChat()
              .recordCompletedToolCalls(currentModel, completedToolCalls);
          } catch (error) {
            logger.warn('⚠️  Could not record tool calls', {
              error: error instanceof Error ? error.message : String(error),
            });
          }

          currentMessages = [{role: 'user', parts: toolResponseParts}];
        } else {
          logger.info('✅ Conversation complete (no tool calls)');
          break;
        }
      }

      this.updateTurns(turnCount);
      this.completeExecution();

      // Emit final completion event
      yield new FormattedEvent(
        'completion',
        `Conversation completed in ${turnCount} turn${turnCount === 1 ? '' : 's'}`,
      );

      logger.info('✅ GeminiAgent execution complete', {
        turns: turnCount,
        toolsExecuted: this.metadata.toolsExecuted,
      });
    } catch (error) {
      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      } else {
        errorMessage = String(error);
      }

      logger.error('❌ GeminiAgent execution error', {error: errorMessage});

      this.errorExecution(error);

      yield new FormattedEvent('error', errorMessage, {isError: true});
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Abort ongoing execution
   */
  abort(): void {
    if (this.abortController) {
      logger.info('🛑 Aborting GeminiAgent execution');
      this.abortController.abort();
    }
  }

  /**
   * Check if agent is currently executing
   */
  isExecuting(): boolean {
    return (
      this.metadata.state === 'executing' && this.abortController !== null
    );
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed()) return;

    logger.info('🧹 Destroying GeminiAgent');

    this.markDestroyed();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.geminiClient = null;
    this.geminiConfig = null;

    logger.info('✅ GeminiAgent destroyed');
  }
}
