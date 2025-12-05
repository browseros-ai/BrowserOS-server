import {
  Config as GeminiConfig,
  MCPServerConfig,
  GeminiEventType,
  executeToolCall,
  type GeminiClient,
  type ToolCallRequestInfo,
} from '@google/gemini-cli-core';
import type { Part } from '@google/genai';
import { logger, fetchBrowserOSConfig, getLLMConfigFromProvider } from '@browseros/common';
import { VercelAIContentGenerator, AIProvider } from './gemini-vercel-sdk-adapter/index.js';
import type { HonoSSEStream } from './gemini-vercel-sdk-adapter/types.js';
import { AgentExecutionError } from '../errors.js';
import type { AgentConfig } from './types.js';
import type { BrowserContext } from '../http/types.js';
import { getSystemPrompt } from './GeminiAgent.prompt.js';
import { formatUIMessageStreamEvent } from './gemini-vercel-sdk-adapter/ui-message-stream.js';

const MAX_TURNS = 100;
const TOOL_TIMEOUT_MS = 120000; // 2 minutes timeout per tool call
const DEFAULT_CONTEXT_WINDOW = 1000000; // 1M tokens (gemini-cli-core default)
const DEFAULT_COMPRESSION_RATIO = 0.75; // Compress at 75% of context window

interface McpHttpServerOptions {
  httpUrl: string;
  headers?: Record<string, string>;
  trust?: boolean;
}

// MCP Server Config for HTTP is a positional argument in the constructor (can't be passed as an object)
function createHttpMcpServerConfig(options: McpHttpServerOptions): MCPServerConfig {
  return new MCPServerConfig(
    undefined,        // command (stdio)
    undefined,        // args (stdio)
    undefined,        // env (stdio)
    undefined,        // cwd (stdio)
    undefined,        // url (sse transport)
    options.httpUrl,  // httpUrl (streamable http)
    options.headers,  // headers
    undefined,        // tcp (websocket)
    undefined,        // timeout
    options.trust,    // trust
  );
}

export class GeminiAgent {
  private constructor(
    private client: GeminiClient,
    private geminiConfig: GeminiConfig,
    private contentGenerator: VercelAIContentGenerator,
    private conversationId: string,
  ) {}

  static async create(config: AgentConfig): Promise<GeminiAgent> {
    const tempDir = config.tempDir;

    // If provider is BROWSEROS, fetch config from BROWSEROS_CONFIG_URL
    let resolvedConfig = { ...config };
    if (config.provider === AIProvider.BROWSEROS) {
      const configUrl = process.env.BROWSEROS_CONFIG_URL;
      if (!configUrl) {
        throw new Error('BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider');
      }

      logger.info('Fetching BrowserOS config', { configUrl });
      const browserosConfig = await fetchBrowserOSConfig(configUrl);
      const llmConfig = getLLMConfigFromProvider(browserosConfig, 'default');

      resolvedConfig = {
        ...config,
        model: llmConfig.modelName,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
      };

      logger.info('Using BrowserOS config', {
        model: resolvedConfig.model,
        baseUrl: resolvedConfig.baseUrl,
      });
    }

    const modelString = `${resolvedConfig.provider}/${resolvedConfig.model}`;

    // Calculate compression threshold based on context window size
    // Formula: (DEFAULT_COMPRESSION_RATIO * contextWindowSize) / DEFAULT_CONTEXT_WINDOW
    // This converts absolute token threshold to gemini-cli-core's multiplier format
    const contextWindow = resolvedConfig.contextWindowSize ?? DEFAULT_CONTEXT_WINDOW;
    const compressionThreshold = (DEFAULT_COMPRESSION_RATIO * contextWindow) / DEFAULT_CONTEXT_WINDOW;

    logger.info('Compression config', {
      contextWindow,
      compressionRatio: compressionThreshold,
      compressionThreshold,
      compressesAtTokens: Math.floor(DEFAULT_COMPRESSION_RATIO * contextWindow),
    });

    const geminiConfig = new GeminiConfig({
      sessionId: resolvedConfig.conversationId,
      targetDir: tempDir,
      cwd: tempDir,
      debugMode: false,
      model: modelString,
      excludeTools: ['run_shell_command', 'write_file', 'replace'],
      compressionThreshold: compressionThreshold,
      mcpServers: resolvedConfig.mcpServerUrl
        ? {
            'browseros-mcp': createHttpMcpServerConfig({
              httpUrl: resolvedConfig.mcpServerUrl,
              headers: { 'Accept': 'application/json, text/event-stream' },
              trust: true,
            }),
          }
        : undefined,
    });

    await geminiConfig.initialize();
    const contentGenerator = new VercelAIContentGenerator(resolvedConfig);

    (geminiConfig as unknown as { contentGenerator: VercelAIContentGenerator }).contentGenerator = contentGenerator;

    const client = geminiConfig.getGeminiClient();
    client.getChat().setSystemInstruction(getSystemPrompt());
    await client.setTools();

    logger.info('GeminiAgent created', {
      conversationId: resolvedConfig.conversationId,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
    });

    return new GeminiAgent(client, geminiConfig, contentGenerator, resolvedConfig.conversationId);
  }

  getHistory() {
    return this.client.getHistory();
  }

  async execute(
    message: string,
    honoStream: HonoSSEStream,
    signal?: AbortSignal,
    browserContext?: BrowserContext,
  ): Promise<void> {
    this.contentGenerator.setHonoStream(honoStream);

    const abortSignal = signal || new AbortController().signal;
    const promptId = `${this.conversationId}-${Date.now()}`;

    // Prepend browser context to the message if provided
    let messageWithContext = message;
    if (browserContext?.activeTab) {
      const tab = browserContext.activeTab;
      const tabContext = `[Active Tab: id=${tab.id}${tab.url ? `, url="${tab.url}"` : ''}${tab.title ? `, title="${tab.title}"` : ''}]\n\n`;
      messageWithContext = tabContext + message;
    }

    let currentParts: Part[] = [{ text: messageWithContext }];
    let turnCount = 0;

    logger.info('Starting agent execution', {
      conversationId: this.conversationId,
      message: message.substring(0, 100),
      historyLength: this.client.getHistory().length,
    });

    while (true) {
      turnCount++;
      logger.debug(`Turn ${turnCount}`, { conversationId: this.conversationId });

      if (turnCount > MAX_TURNS) {
        logger.warn('Max turns exceeded', {
          conversationId: this.conversationId,
          turnCount,
        });
        break;
      }

      const toolCallRequests: ToolCallRequestInfo[] = [];

      const responseStream = this.client.sendMessageStream(
        currentParts,
        abortSignal,
        promptId,
      );

      for await (const event of responseStream) {
        if (abortSignal.aborted) {
          break;
        }

        if (event.type === GeminiEventType.ToolCallRequest) {
          toolCallRequests.push(event.value as ToolCallRequestInfo);
        } else if (event.type === GeminiEventType.Error) {
          const errorValue = event.value as { error: Error };
          throw new AgentExecutionError('Agent execution failed', errorValue.error);
        }
        // Other events are handled by the content generator
      }

      if (toolCallRequests.length > 0) {
        logger.debug(`Executing ${toolCallRequests.length} tool(s)`, {
          conversationId: this.conversationId,
          tools: toolCallRequests.map((r) => r.name),
        });

        const toolResponseParts: Part[] = [];

        for (const requestInfo of toolCallRequests) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Tool "${requestInfo.name}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)), TOOL_TIMEOUT_MS);
            });

            const completedToolCall = await Promise.race([
              executeToolCall(this.geminiConfig, requestInfo, abortSignal),
              timeoutPromise,
            ]);

            const toolResponse = completedToolCall.response;

            if (toolResponse.error) {
              logger.warn('Tool execution error', {
                conversationId: this.conversationId,
                tool: requestInfo.name,
                error: toolResponse.error.message,
              });
              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: requestInfo.name,
                  response: { error: toolResponse.error.message },
                },
              } as Part);
              if (honoStream) {
                honoStream.write(formatUIMessageStreamEvent({
                  type: 'tool-output-error',
                  toolCallId: requestInfo.callId,
                  errorText: toolResponse.error.message,
                }));
              }
            } else if (toolResponse.responseParts && toolResponse.responseParts.length > 0) {
              toolResponseParts.push(...(toolResponse.responseParts as Part[]));
              if (honoStream) {
                honoStream.write(formatUIMessageStreamEvent({
                  type: 'tool-output-available',
                  toolCallId: requestInfo.callId,
                  output: toolResponse.responseParts,
                }));
              }
            } else {
              logger.warn('Tool returned empty response', {
                conversationId: this.conversationId,
                tool: requestInfo.name,
              });
              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: requestInfo.name,
                  response: { output: 'Tool executed but returned no output.' },
                },
              } as Part);
              if (honoStream) {
                honoStream.write(formatUIMessageStreamEvent({
                  type: 'tool-output-error',
                  toolCallId: requestInfo.callId,
                  errorText: 'Tool executed but returned no output.',
                }));
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Tool execution failed', {
              conversationId: this.conversationId,
              tool: requestInfo.name,
              error: errorMessage,
            });

            toolResponseParts.push({
              functionResponse: {
                id: requestInfo.callId,
                name: requestInfo.name,
                response: { error: errorMessage },
              },
            } as Part);
            if (honoStream) {
              honoStream.write(formatUIMessageStreamEvent({
                type: 'tool-output-error',
                toolCallId: requestInfo.callId,
                errorText: errorMessage,
              }));
            }
          }
        }

        currentParts = toolResponseParts;
      } else {
        logger.info('Agent execution complete', {
          conversationId: this.conversationId,
          totalTurns: turnCount,
        });
        break;
      }
    }
  }
}
