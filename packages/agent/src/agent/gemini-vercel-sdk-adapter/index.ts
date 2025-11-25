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
import { AIProvider } from './types.js';
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
    const contents = (Array.isArray(request.contents) ? request.contents : [request.contents]) as Content[];
    const messages = this.messageStrategy.geminiToVercel(contents);
    const tools = this.toolStrategy.geminiToVercel(request.config?.tools);

    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    );

    const { provider, modelName } = this.parseModel(
      request.model || this.model,
    );
    const providerInstance = this.getProvider(provider);

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

    return this.responseStrategy.vercelToGemini(result);
  }

  /**
   * Streaming content generation
   */
  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const contents = (Array.isArray(request.contents) ? request.contents : [request.contents]) as Content[];
    const messages = this.messageStrategy.geminiToVercel(contents);
    const tools = this.toolStrategy.geminiToVercel(request.config?.tools);
    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    );

    const { provider, modelName } = this.parseModel(
      request.model || this.model,
    );
    const providerInstance = this.getProvider(provider);

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
        } catch {
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
    const providers = config.providers || {};

    const anthropicConfig = providers[AIProvider.ANTHROPIC];
    if (anthropicConfig?.apiKey) {
      this.providerRegistry.set(
        AIProvider.ANTHROPIC,
        createAnthropic({ apiKey: anthropicConfig.apiKey }),
      );
    }

    const openaiConfig = providers[AIProvider.OPENAI];
    if (openaiConfig?.apiKey) {
      this.providerRegistry.set(
        AIProvider.OPENAI,
        createOpenAI({
          apiKey: openaiConfig.apiKey,
          compatibility: 'strict',
        }),
      );
    }

    const googleConfig = providers[AIProvider.GOOGLE];
    if (googleConfig?.apiKey) {
      this.providerRegistry.set(
        AIProvider.GOOGLE,
        createGoogleGenerativeAI({ apiKey: googleConfig.apiKey }),
      );
    }

    const openrouterConfig = providers[AIProvider.OPENROUTER];
    if (openrouterConfig?.apiKey) {
      this.providerRegistry.set(
        AIProvider.OPENROUTER,
        createOpenRouter({ apiKey: openrouterConfig.apiKey }),
      );
    }

    const azureConfig = providers[AIProvider.AZURE];
    if (azureConfig?.apiKey && azureConfig.resourceName) {
      this.providerRegistry.set(
        AIProvider.AZURE,
        createAzure({
          resourceName: azureConfig.resourceName,
          apiKey: azureConfig.apiKey,
        }),
      );
    }

    const lmstudioConfig = providers[AIProvider.LMSTUDIO];
    if (lmstudioConfig !== undefined) {
      this.providerRegistry.set(
        AIProvider.LMSTUDIO,
        createOpenAICompatible({
          name: 'lmstudio',
          baseURL: lmstudioConfig.baseUrl || 'http://localhost:1234/v1',
        }),
      );
    }

    const ollamaConfig = providers[AIProvider.OLLAMA];
    if (ollamaConfig !== undefined) {
      this.providerRegistry.set(
        AIProvider.OLLAMA,
        createOpenAICompatible({
          name: 'ollama',
          baseURL: ollamaConfig.baseUrl || 'http://localhost:11434/v1',
        }),
      );
    }

    const bedrockConfig = providers[AIProvider.BEDROCK];
    if (
      bedrockConfig?.accessKeyId &&
      bedrockConfig.secretAccessKey &&
      bedrockConfig.region
    ) {
      this.providerRegistry.set(
        AIProvider.BEDROCK,
        createAmazonBedrock({
          region: bedrockConfig.region,
          accessKeyId: bedrockConfig.accessKeyId,
          secretAccessKey: bedrockConfig.secretAccessKey,
          sessionToken: bedrockConfig.sessionToken,
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
          `Configure it in config.providers.${provider}`,
      );
    }

    return providerInstance;
  }
}

// Re-export types for consumers
export { AIProvider };
export type { VercelAIConfig, ProviderConfig, HonoSSEStream } from './types.js';
