/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Vercel AI ContentGenerator Implementation
 * Multi-provider LLM adapter using Vercel AI SDK
 */

import { streamText, generateText, convertToModelMessages } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAzure } from '@ai-sdk/azure';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

import type { ContentGenerator } from '@google/gemini-cli-core';
import type { HonoSSEStream } from './types.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  Content,
} from '@google/genai';
import {
  ToolConversionStrategy,
  MessageConversionStrategy,
  ResponseConversionStrategy,
} from './strategies/index.js';
import type { VercelAIConfig } from './types.js';

/**
 * Vercel AI ContentGenerator
 * Implements ContentGenerator interface using strategy pattern for conversions
 */
export class VercelAIContentGenerator implements ContentGenerator {
  private providerRegistry: Map<string, (modelId: string) => unknown>;
  private model: string;
  private honoStream?: HonoSSEStream;

  // Conversion strategies
  private toolStrategy: ToolConversionStrategy;
  private messageStrategy: MessageConversionStrategy;
  private responseStrategy: ResponseConversionStrategy;

  constructor(config: VercelAIConfig) {
    this.model = config.model;
    this.honoStream = config.honoStream;
    this.providerRegistry = new Map();

    // Initialize conversion strategies
    this.toolStrategy = new ToolConversionStrategy();
    this.messageStrategy = new MessageConversionStrategy();
    this.responseStrategy = new ResponseConversionStrategy(this.toolStrategy);

    // Register providers based on config
    this.registerProviders(config);
  }

  /**
   * Non-streaming content generation
   */
  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    console.log('[VercelAI] generateContent called');
    console.log('  request.config?.tools:', request.config?.tools ? `${request.config.tools.length} tools` : 'undefined');

    // Convert Gemini request to Vercel format using strategies
    const contents = (Array.isArray(request.contents) ? request.contents : [request.contents]) as Content[];
    const messages = this.messageStrategy.geminiToVercel(contents);
    const tools = this.toolStrategy.geminiToVercel(request.config?.tools);
    console.log('  Converted tools:', tools ? `${Object.keys(tools).length} tools` : 'undefined');

    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    );

    // Get provider
    const { provider, modelName } = this.parseModel(
      request.model || this.model,
    );
    const providerInstance = this.getProvider(provider);

    // Call Vercel AI SDK
    const result = await generateText({
      model: providerInstance(modelName) as Parameters<
        typeof generateText
      >[0]['model'],
      messages,
      system,
      tools,
      temperature: request.config?.temperature,
      topP: request.config?.topP,
    });

    console.log('[VercelAI] Non-streaming result.usage:', JSON.stringify(result.usage, null, 2));

    // Convert response back to Gemini format using strategy
    return this.responseStrategy.vercelToGemini(result);
  }

  /**
   * Streaming content generation
   */
  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // INVESTIGATION: Log what Gemini sends us
    console.log('\n[VercelAI] === generateContentStream called ===');
    console.log('request.contents (raw from Gemini):', JSON.stringify(request.contents, null, 2));

    // Convert Gemini request to Vercel format using strategies
    const contents = (Array.isArray(request.contents) ? request.contents : [request.contents]) as Content[];

    console.log('\nConverting to Vercel messages...');
    const messages = this.messageStrategy.geminiToVercel(contents);

    console.log('\nVercel messages (to be sent to LLM):', JSON.stringify(messages, null, 2));

    // INVESTIGATION: Log raw tools from Gemini CLI Core
    console.log('\n[VercelAI] === Tools from Gemini CLI Core ===');
    console.log('request.config?.tools:', JSON.stringify(request.config?.tools, null, 2));

    const tools = this.toolStrategy.geminiToVercel(request.config?.tools);
    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    );

    // Get provider
    const { provider, modelName } = this.parseModel(
      request.model || this.model,
    );
    const providerInstance = this.getProvider(provider);

    // DEEP DEBUG: Log messages being sent to LLM
    console.log('\n[VercelAI→OpenAI] === MESSAGES BEING SENT TO LLM ===');
    console.log(`Total messages: ${messages.length}`);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`\nMessage #${i + 1}:`);
      console.log(`  Role: ${msg.role}`);

      if (typeof msg.content === 'string') {
        console.log(`  Content (string): ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
      } else if (Array.isArray(msg.content)) {
        console.log(`  Content (array): ${msg.content.length} parts`);
        for (let j = 0; j < msg.content.length; j++) {
          const part = msg.content[j];
          console.log(`    Part #${j + 1}:`);
          console.log(`      Type: ${(part as any).type}`);
          if ((part as any).type === 'text') {
            console.log(`      Text: ${(part as any).text?.substring(0, 100)}...`);
          } else if ((part as any).type === 'image') {
            const img = (part as any).image || '';
            const imgDesc = img instanceof Uint8Array
              ? `Uint8Array[${img.length} bytes]`
              : typeof img === 'string'
              ? `${img.substring(0, 50)}... [${img.length} chars]`
              : `${img}`;
            console.log(`      Image: ${imgDesc}`);
          } else if ((part as any).type === 'tool-result') {
            console.log(`      ToolCallId: ${(part as any).toolCallId}`);
            console.log(`      ToolName: ${(part as any).toolName}`);
            console.log(`      Output: ${JSON.stringify((part as any).output).substring(0, 100)}...`);
          } else if ((part as any).type === 'tool-call') {
            console.log(`      ToolCallId: ${(part as any).toolCallId}`);
            console.log(`      ToolName: ${(part as any).toolName}`);
          }
        }
      } else {
        console.log(`  Content (other): ${typeof msg.content}`);
      }
    }
    console.log('[VercelAI→OpenAI] === END MESSAGES ===\n');

    // Call Vercel AI SDK
    const result = streamText({
      model: providerInstance(modelName) as Parameters<
        typeof streamText
      >[0]['model'],
      messages,
      system,
      tools,
      temperature: request.config?.temperature,
      topP: request.config?.topP,
    });

    // Convert stream to Gemini format using strategy
    // Pass function to get usage after stream completes
    // Pass honoStream for dual output (raw Vercel chunks to SSE + Gemini events)
    return this.responseStrategy.streamToGemini(
      result.fullStream,
      async () => {
        try {
          const usage = await result.usage;
          return {
            promptTokens: (usage as { promptTokens?: number }).promptTokens,
            completionTokens: (usage as { completionTokens?: number })
              .completionTokens,
            totalTokens: (usage as { totalTokens?: number }).totalTokens,
          };
        } catch (error) {
          console.error('[VercelAI] Error getting usage:', error);
          return undefined;
        }
      },
      this.honoStream,
    );
  }

  /**
   * Count tokens (estimation)
   */
  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Rough estimation: 1 token ≈ 4 characters
    const text = JSON.stringify(request.contents);
    const estimatedTokens = Math.ceil(text.length / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  /**
   * Embed content (not universally supported)
   */
  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error(
      'Embeddings not universally supported across providers. ' +
        'Use provider-specific embedding endpoints.',
    );
  }

  /**
   * Register providers based on config
   */
  private registerProviders(config: VercelAIConfig): void {
    if (config.apiKeys?.anthropic) {
      this.providerRegistry.set(
        'anthropic',
        createAnthropic({ apiKey: config.apiKeys.anthropic }),
      );
    }

    if (config.apiKeys?.openai) {
      this.providerRegistry.set(
        'openai',
        createOpenAI({
          apiKey: config.apiKeys.openai,
          compatibility: 'strict', // Enable streaming token usage
        }),
      );
    }

    if (config.apiKeys?.google) {
      this.providerRegistry.set(
        'google',
        createGoogleGenerativeAI({ apiKey: config.apiKeys.google }),
      );
    }

    if (config.apiKeys?.openrouter) {
      this.providerRegistry.set(
        'openrouter',
        createOpenRouter({ apiKey: config.apiKeys.openrouter }),
      );
    }

    if (config.apiKeys?.azure && config.azureResourceName) {
      this.providerRegistry.set(
        'azure',
        createAzure({
          resourceName: config.azureResourceName,
          apiKey: config.apiKeys.azure,
        }),
      );
    }

    if (config.lmstudioBaseUrl !== undefined) {
      this.providerRegistry.set(
        'lmstudio',
        createOpenAICompatible({
          name: 'lmstudio',
          baseURL: config.lmstudioBaseUrl || 'http://localhost:1234/v1',
        }),
      );
    }

    if (config.ollamaBaseUrl !== undefined) {
      this.providerRegistry.set(
        'ollama',
        createOpenAICompatible({
          name: 'ollama',
          baseURL: config.ollamaBaseUrl || 'http://localhost:11434/v1',
        }),
      );
    }

    if (
      config.awsAccessKeyId &&
      config.awsSecretAccessKey &&
      config.awsRegion
    ) {
      this.providerRegistry.set(
        'bedrock',
        createAmazonBedrock({
          region: config.awsRegion,
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
          sessionToken: config.awsSessionToken,
        }),
      );
    }
  }

  /**
   * Parse model string into provider and model name
   */
  private parseModel(modelString: string): {
    provider: string;
    modelName: string;
  } {
    const parts = modelString.split('/');

    if (parts.length < 2) {
      throw new Error(
        `Invalid model format: "${modelString}". ` +
          `Expected "provider/model-name" (e.g., "anthropic/claude-3-5-sonnet-20241022")`,
      );
    }

    const provider = parts[0];
    const modelName = parts.slice(1).join('/');

    return { provider, modelName };
  }

  /**
   * Get provider instance or throw error
   */
  private getProvider(provider: string): (modelId: string) => unknown {
    const providerInstance = this.providerRegistry.get(provider);

    if (!providerInstance) {
      const available = Array.from(this.providerRegistry.keys()).join(', ');
      throw new Error(
        `Provider "${provider}" not configured. ` +
          `Available providers: ${available || 'none'}. ` +
          `Add API key in config.apiKeys.${provider}`,
      );
    }

    return providerInstance;
  }
}
