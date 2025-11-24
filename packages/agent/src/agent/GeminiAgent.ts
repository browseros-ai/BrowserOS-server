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
import {VercelAIContentGenerator} from './adapters/vercel-ai/index.js';
import type {VercelAIConfig} from './adapters/vercel-ai/types.js';

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

  // Vercel AI multi-provider support
  private useVercelAI: boolean = false;
  private vercelProvider: 'anthropic' | 'openai' | 'google' | null = null;

  constructor(config: AgentConfig, controllerBridge: ControllerBridge) {
    logger.info('🔧 GeminiAgent constructor called', {
      resourcesDir: config.resourcesDir,
      executionDir: config.executionDir,
      mcpServerPort: config.mcpServerPort || 9100,
    });

    super('gemini-sdk', config, {
      systemPrompt: AGENT_SYSTEM_PROMPT,
      maxTurns: GEMINI_AGENT_DEFAULTS.maxTurns,
      maxThinkingTokens: GEMINI_AGENT_DEFAULTS.maxThinkingTokens,
    });

    logger.info('✅ GeminiAgent base initialized (Vercel AI multi-provider ready)');
  }

  /**
   * Initialize agent - detect Vercel AI provider from environment variables
   * Supports: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY
   */
  override async init(): Promise<void> {
    logger.info('🔍 Detecting Vercel AI provider from environment...');

    // Detect Vercel AI provider from environment variables
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const googleKey = process.env.GOOGLE_API_KEY;

    logger.debug('Environment check:', {
      hasAnthropicKey: !!anthropicKey,
      hasOpenAIKey: !!openaiKey,
      hasGoogleKey: !!googleKey,
    });

    if (anthropicKey) {
      this.useVercelAI = true;
      this.vercelProvider = 'anthropic';
      this.config.apiKey = anthropicKey;
      this.config.modelName = 'claude-sonnet-4-5';
      logger.info('✅ Detected Anthropic Claude provider', {
        provider: 'anthropic',
        model: this.config.modelName,
        apiKeyPrefix: anthropicKey.substring(0, 7) + '...',
      });
    } else if (openaiKey) {
      this.useVercelAI = true;
      this.vercelProvider = 'openai';
      this.config.apiKey = openaiKey;
      this.config.modelName = 'gpt-4o';
      logger.info('✅ Detected OpenAI GPT provider', {
        provider: 'openai',
        model: this.config.modelName,
        apiKeyPrefix: openaiKey.substring(0, 7) + '...',
      });
    } else if (googleKey) {
      this.useVercelAI = true;
      this.vercelProvider = 'google';
      this.config.apiKey = googleKey;
      this.config.modelName = 'gemini-2.0-flash-exp';
      logger.info('✅ Detected Google Gemini provider', {
        provider: 'google',
        model: this.config.modelName,
        apiKeyPrefix: googleKey.substring(0, 7) + '...',
      });
    } else {
      logger.error('❌ No API key found in environment');
      throw new Error(
        'No API key found. Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY',
      );
    }

    await this.initializeGeminiClient();
    await super.init();
  }

  /**
   * Initialize Gemini Config and Client with Vercel AI ContentGenerator
   */
  private async initializeGeminiClient(): Promise<void> {
    const mcpServerPort = this.config.mcpServerPort || 9100;
    const sessionId = `gemini-${Date.now()}`;

    // Build model string for Vercel AI: "provider/model-name"
    const modelString = this.useVercelAI
      ? `${this.vercelProvider}/${this.config.modelName}`
      : DEFAULT_GEMINI_FLASH_MODEL;

    this.geminiConfig = new GeminiConfig({
      sessionId,
      targetDir: this.config.executionDir,
      cwd: this.config.executionDir,
      debugMode: false,
      model: modelString,
      excludeTools: ['run_shell_command', 'write_file', 'replace'],
      compressionThreshold: 1000000, // Disable aggressive compression (1M tokens threshold)
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

    if (this.useVercelAI) {
      logger.info('🔧 Configuring Vercel AI ContentGenerator...');

      // Inject Vercel AI ContentGenerator
      const vercelConfig: VercelAIConfig = {
        model: modelString,
        apiKeys: {},
      };

      // Set API key for the detected provider
      if (this.vercelProvider === 'anthropic') {
        vercelConfig.apiKeys!.anthropic = this.config.apiKey;
      } else if (this.vercelProvider === 'openai') {
        vercelConfig.apiKeys!.openai = this.config.apiKey;
      } else if (this.vercelProvider === 'google') {
        vercelConfig.apiKeys!.google = this.config.apiKey;
      }

      logger.debug('Vercel AI Config:', {
        model: vercelConfig.model,
        provider: this.vercelProvider,
        hasApiKey: !!vercelConfig.apiKeys![this.vercelProvider!],
        apiKeyLength: this.config.apiKey?.length,
      });

      const contentGenerator = new VercelAIContentGenerator(vercelConfig);
      logger.debug('✅ VercelAIContentGenerator instance created');

      // Type assertion needed as contentGenerator is private in Config
      (this.geminiConfig as any).contentGenerator = contentGenerator;
      logger.debug('✅ ContentGenerator injected into GeminiConfig');

      logger.info('✅ Vercel AI mode configured successfully', {
        provider: this.vercelProvider,
        model: this.config.modelName,
        fullModelString: modelString,
      });
    } else {
      // Native Gemini mode
      logger.info('🔧 Configuring Native Gemini mode...');
      if (this.config.apiKey) {
        process.env.GEMINI_API_KEY = this.config.apiKey;
      }
      await this.geminiConfig.refreshAuth(AuthType.USE_GEMINI);
      logger.info('✅ Native Gemini auth configured');
    }

    this.geminiClient = this.geminiConfig.getGeminiClient();

    if (this.config.systemPrompt) {
      this.geminiClient
        .getChat()
        .setSystemInstruction(this.config.systemPrompt);
    }

    this.promptId = `prompt-${Date.now()}`;

    logger.info('✅ GeminiClient initialized', {
      mode: this.useVercelAI ? 'Vercel AI' : 'Native Gemini',
      model: this.config.modelName,
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

    logger.info('🤖 GeminiAgent executing', {
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      mode: this.useVercelAI ? 'Vercel AI' : 'Native Gemini',
      provider: this.vercelProvider || 'gemini',
      model: this.config.modelName,
    });

    try {
      const initMessage = this.useVercelAI
        ? `Starting execution with ${this.vercelProvider?.toUpperCase()} via Vercel AI`
        : 'Starting execution with Gemini';
      yield new FormattedEvent('init', initMessage);

      let currentMessages: any[] = [{role: 'user', parts: [{text: message}]}];
      let turnCount = 0;
      const maxTurns = this.config.maxTurns || GEMINI_AGENT_DEFAULTS.maxTurns;
      let lastResponse = '';

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

              // Track last response text from thinking events (agent's actual response)
              // Exclude system messages like "Thinking..." and "Chat history compressed"
              if (
                evt.type === 'thinking' &&
                evt.content &&
                evt.content !== 'Thinking...' &&
                evt.content !== 'Chat history compressed'
              ) {
                lastResponse = evt.content;
              }
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

      // Emit final completion event with last response
      yield new FormattedEvent(
        'completion',
        lastResponse || `Conversation completed in ${turnCount} turn${turnCount === 1 ? '' : 's'}`,
      );

      logger.info('✅ GeminiAgent execution complete', {
        mode: this.useVercelAI ? 'Vercel AI' : 'Native Gemini',
        provider: this.vercelProvider || 'gemini',
        model: this.config.modelName,
        turns: turnCount,
        toolsExecuted: this.metadata.toolsExecuted,
        duration: Date.now() - this.executionStartTime,
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
