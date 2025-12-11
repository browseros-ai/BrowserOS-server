/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {
  logger,
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '@browseros/common';
import {
  Config as GeminiConfig,
  MCPServerConfig,
  GeminiEventType,
  executeToolCall,
  type GeminiClient,
  type ToolCallRequestInfo,
} from '@google/gemini-cli-core';
import type {Part} from '@google/genai';

import {AgentExecutionError} from '../errors.js';
import type {BrowserContext} from '../http/types.js';
import {StrataManager} from '../strata/index.js';

import {
  VercelAIContentGenerator,
  AIProvider,
} from './gemini-vercel-sdk-adapter/index.js';
import type {HonoSSEStream} from './gemini-vercel-sdk-adapter/types.js';
import {UIMessageStreamWriter} from './gemini-vercel-sdk-adapter/ui-message-stream.js';
import {getSystemPrompt} from './GeminiAgent.prompt.js';
import {
  SubAgentExecutor,
  TASK_TOOL_NAME,
  TaskToolInputSchema,
  TaskDeclarativeTool,
} from './subagent/index.js';
import type {AgentConfig, GeminiAgentOptions} from './types.js';

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
function createHttpMcpServerConfig(
  options: McpHttpServerOptions,
): MCPServerConfig {
  return new MCPServerConfig(
    undefined, // command (stdio)
    undefined, // args (stdio)
    undefined, // env (stdio)
    undefined, // cwd (stdio)
    undefined, // url (sse transport)
    options.httpUrl, // httpUrl (streamable http)
    options.headers, // headers
    undefined, // tcp (websocket)
    undefined, // timeout
    options.trust, // trust
  );
}

export class GeminiAgent {
  private isSubAgent: boolean;
  private maxTurns: number;
  private subAgentExecutor?: SubAgentExecutor;

  private constructor(
    private client: GeminiClient,
    private geminiConfig: GeminiConfig,
    private contentGenerator: VercelAIContentGenerator,
    private conversationId: string,
    private config: AgentConfig,
    options: GeminiAgentOptions = {},
  ) {
    this.isSubAgent = options.isSubAgent ?? false;
    this.maxTurns = options.maxTurns ?? MAX_TURNS;

    // Only parent agents can spawn subagents
    if (!this.isSubAgent) {
      this.subAgentExecutor = new SubAgentExecutor(config);
    }
  }

  static async create(
    config: AgentConfig,
    options: GeminiAgentOptions = {},
  ): Promise<GeminiAgent> {
    const tempDir = config.tempDir;

    // If provider is BROWSEROS, fetch config from BROWSEROS_CONFIG_URL
    let resolvedConfig = {...config};
    if (config.provider === AIProvider.BROWSEROS) {
      const configUrl = process.env.BROWSEROS_CONFIG_URL;
      if (!configUrl) {
        throw new Error(
          'BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider',
        );
      }

      logger.info('Fetching BrowserOS config', {configUrl});
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
    const contextWindow =
      resolvedConfig.contextWindowSize ?? DEFAULT_CONTEXT_WINDOW;
    const compressionThreshold =
      (DEFAULT_COMPRESSION_RATIO * contextWindow) / DEFAULT_CONTEXT_WINDOW;

    logger.info('Compression config', {
      contextWindow,
      compressionRatio: compressionThreshold,
      compressionThreshold,
      compressesAtTokens: Math.floor(DEFAULT_COMPRESSION_RATIO * contextWindow),
    });

    // Build MCP servers config
    const mcpServers: Record<string, MCPServerConfig> = {};

    // Add BrowserOS MCP server if configured
    if (resolvedConfig.mcpServerUrl) {
      mcpServers['browseros-mcp'] = createHttpMcpServerConfig({
        httpUrl: resolvedConfig.mcpServerUrl,
        headers: {Accept: 'application/json, text/event-stream'},
        trust: true,
      });
    }

    // Add Klavis Strata MCP server if userId is provided
    if (resolvedConfig.klavisUserId) {
      const strataManager = new StrataManager();
      const strataUrl = await strataManager.getOrCreateStrataUrl(
        resolvedConfig.klavisUserId,
      );
      if (strataUrl) {
        mcpServers['klavis-strata'] = createHttpMcpServerConfig({
          httpUrl: strataUrl,
          trust: true,
        });
        logger.info('Added Klavis Strata MCP server', {
          userId: resolvedConfig.klavisUserId,
        });
      }
    }
    logger.debug('MCP servers config', { mcpServers });

    // Exclude Task tool for subagents to prevent recursion
    const excludeTools = ['run_shell_command', 'write_file', 'replace'];
    if (options.isSubAgent) {
      excludeTools.push(TASK_TOOL_NAME);
    }

    const geminiConfig = new GeminiConfig({
      sessionId: resolvedConfig.conversationId,
      targetDir: tempDir,
      cwd: tempDir,
      debugMode: false,
      model: modelString,
      excludeTools,
      compressionThreshold: compressionThreshold,
      mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
    });

    await geminiConfig.initialize();
    const contentGenerator = new VercelAIContentGenerator(resolvedConfig);

    (
      geminiConfig as unknown as {contentGenerator: VercelAIContentGenerator}
    ).contentGenerator = contentGenerator;

    // Register Task tool for parent agents (subagents have it excluded)
    if (!options.isSubAgent) {
      const toolRegistry = geminiConfig.getToolRegistry();
      toolRegistry.registerTool(new TaskDeclarativeTool());
      logger.debug('Registered Task tool for subagent spawning');
    }

    const client = geminiConfig.getGeminiClient();
    client.getChat().setSystemInstruction(getSystemPrompt());
    await client.setTools();

    // Disable chat recording to prevent disk writes
    const recordingService = client.getChatRecordingService();
    if (recordingService) {
      (
        recordingService as unknown as {conversationFile: string | null}
      ).conversationFile = null;
    }

    logger.info('GeminiAgent created', {
      conversationId: resolvedConfig.conversationId,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      isSubAgent: options.isSubAgent ?? false,
    });

    return new GeminiAgent(
      client,
      geminiConfig,
      contentGenerator,
      resolvedConfig.conversationId,
      resolvedConfig,
      options,
    );
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
    const abortSignal = signal || new AbortController().signal;
    const promptId = `${this.conversationId}-${Date.now()}`;

    // Prepend browser context to the message if provided
    let messageWithContext = message;
    if (browserContext?.activeTab || browserContext?.selectedTabs?.length) {
      const formatTab = (tab: {id: number; url?: string; title?: string}) =>
        `Tab ${tab.id}${tab.title ? ` - "${tab.title}"` : ''}${tab.url ? ` (${tab.url})` : ''}`;

      const contextLines: string[] = ['## Browser Context'];

      if (browserContext.activeTab) {
        contextLines.push(
          `**User's Active Tab:** ${formatTab(browserContext.activeTab)}`,
        );
      }

      if (browserContext.selectedTabs?.length) {
        contextLines.push(
          `**User's Selected Tabs (${browserContext.selectedTabs.length}):**`,
        );
        browserContext.selectedTabs.forEach((tab, i) => {
          contextLines.push(`  ${i + 1}. ${formatTab(tab)}`);
        });
      }

      messageWithContext = `${contextLines.join('\n')}\n\n---\n\n${message}`;
    }

    let currentParts: Part[] = [{text: messageWithContext}];
    let turnCount = 0;

    // Create single UIMessageStreamWriter to manage entire stream lifecycle
    const uiStream = honoStream
      ? new UIMessageStreamWriter(async data => {
          try {
            await honoStream.write(data);
          } catch {
            // Failed to write to stream
          }
        })
      : null;

    // Pass shared writer to content generator for LLM streaming
    this.contentGenerator.setUIStream(uiStream ?? undefined);

    if (uiStream) {
      await uiStream.start();
    }

    logger.info('Starting agent execution', {
      conversationId: this.conversationId,
      message: message.substring(0, 100),
      historyLength: this.client.getHistory().length,
    });

    while (true) {
      turnCount++;
      logger.debug(`Turn ${turnCount}`, {conversationId: this.conversationId});

      if (turnCount > this.maxTurns) {
        logger.warn('Max turns exceeded', {
          conversationId: this.conversationId,
          turnCount,
          maxTurns: this.maxTurns,
          isSubAgent: this.isSubAgent,
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
          const errorValue = event.value as {error: Error};
          throw new AgentExecutionError(
            'Agent execution failed',
            errorValue.error,
          );
        }
        // Other events are handled by the content generator
      }

      // Check abort after processing stream
      if (abortSignal.aborted) {
        logger.info('Agent execution aborted', {
          conversationId: this.conversationId,
          turnCount,
        });
        break;
      }

      if (toolCallRequests.length > 0) {
        logger.debug(`Executing ${toolCallRequests.length} tool(s)`, {
          conversationId: this.conversationId,
          tools: toolCallRequests.map(r => r.name),
        });

        const toolResponseParts: Part[] = [];

        for (const requestInfo of toolCallRequests) {
          // Check abort before each tool execution
          if (abortSignal.aborted) {
            break;
          }

          // Intercept Task tool for subagent execution
          if (requestInfo.name === TASK_TOOL_NAME && this.subAgentExecutor) {
            try {
              const input = TaskToolInputSchema.parse(requestInfo.args);

              logger.info('Executing Task tool (spawning subagent)', {
                conversationId: this.conversationId,
                taskDescription: input.description,
                subagentType: input.subagent_type,
              });

              if (uiStream) {
                await uiStream.writeToolCall(requestInfo.callId, TASK_TOOL_NAME, {
                  description: input.description,
                  subagent_type: input.subagent_type,
                });
              }

              const result = await this.subAgentExecutor.execute(
                input,
                honoStream,
                abortSignal,
              );

              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: TASK_TOOL_NAME,
                  response: result.success
                    ? {output: result.result}
                    : {error: result.error || 'Subagent execution failed'},
                },
              } as Part);

              if (uiStream) {
                if (result.success) {
                  await uiStream.writeToolResult(requestInfo.callId, {
                    agentId: result.agentId,
                    turnsUsed: result.turnsUsed,
                    summary:
                      result.result.length > 500
                        ? result.result.substring(0, 500) + '...'
                        : result.result,
                  });
                } else {
                  await uiStream.writeToolError(
                    requestInfo.callId,
                    result.error || 'Unknown error',
                  );
                }
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logger.error('Task tool execution failed', {
                conversationId: this.conversationId,
                error: errorMessage,
              });

              toolResponseParts.push({
                functionResponse: {
                  id: requestInfo.callId,
                  name: TASK_TOOL_NAME,
                  response: {error: errorMessage},
                },
              } as Part);

              if (uiStream) {
                await uiStream.writeToolError(requestInfo.callId, errorMessage);
              }
            }
            continue; // Skip normal tool execution
          }

          // Normal tool execution
          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Tool "${requestInfo.name}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
                    ),
                  ),
                TOOL_TIMEOUT_MS,
              );
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
                  response: {error: toolResponse.error.message},
                },
              } as Part);
              if (uiStream) {
                await uiStream.writeToolError(
                  requestInfo.callId,
                  toolResponse.error.message,
                );
              }
            } else if (
              toolResponse.responseParts &&
              toolResponse.responseParts.length > 0
            ) {
              toolResponseParts.push(...(toolResponse.responseParts as Part[]));
              if (uiStream) {
                await uiStream.writeToolResult(
                  requestInfo.callId,
                  toolResponse.responseParts,
                );
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
                  response: {output: 'Tool executed but returned no output.'},
                },
              } as Part);
              if (uiStream) {
                await uiStream.writeToolError(
                  requestInfo.callId,
                  'Tool executed but returned no output.',
                );
              }
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.error('Tool execution failed', {
              conversationId: this.conversationId,
              tool: requestInfo.name,
              error: errorMessage,
            });

            toolResponseParts.push({
              functionResponse: {
                id: requestInfo.callId,
                name: requestInfo.name,
                response: {error: errorMessage},
              },
            } as Part);
            if (uiStream) {
              await uiStream.writeToolError(requestInfo.callId, errorMessage);
            }
          }
        }

        // Check if aborted during tool execution
        if (abortSignal.aborted) {
          break;
        }

        // Finish the step after all tool outputs are written
        if (uiStream) {
          await uiStream.finishStep();
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

    // Finish the UI stream after all turns complete
    if (uiStream) {
      await uiStream.finish();
    }
  }
}
