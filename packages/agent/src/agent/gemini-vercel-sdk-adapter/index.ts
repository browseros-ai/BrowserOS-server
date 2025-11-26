/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Vercel AI ContentGenerator Implementation
 * Multi-provider LLM adapter using Vercel AI SDK
 */

import { streamText, generateText } from 'ai';
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
  private providerInstance: (modelId: string) => unknown;
  private model: string;
  private honoStream?: HonoSSEStream;

  // Conversion strategies
  private toolStrategy: ToolConversionStrategy;
  private messageStrategy: MessageConversionStrategy;
  private responseStrategy: ResponseConversionStrategy;

  constructor(config: VercelAIConfig) {
    this.model = config.model;

    // Initialize conversion strategies
    this.toolStrategy = new ToolConversionStrategy();
    this.messageStrategy = new MessageConversionStrategy();
    this.responseStrategy = new ResponseConversionStrategy(this.toolStrategy);

    // Register the single provider from config
    this.providerInstance = this.createProvider(config);
  }

  /**
   * Set/override the Hono SSE stream for the current request
   * This allows reusing the same ContentGenerator across multiple requests
   */
  setHonoStream(stream: HonoSSEStream | undefined): void {
    this.honoStream = stream;
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

    const result = await generateText({
      model: this.providerInstance(this.model) as Parameters<
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

    const result = streamText({
      model: this.providerInstance(this.model) as Parameters<
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
   * Create provider instance based on config
   */
  private createProvider(config: VercelAIConfig): (modelId: string) => unknown {
    switch (config.provider) {
      case AIProvider.ANTHROPIC:
        if (!config.apiKey) {
          throw new Error('Anthropic provider requires apiKey');
        }
        return createAnthropic({ apiKey: config.apiKey });

      case AIProvider.OPENAI:
        if (!config.apiKey) {
          throw new Error('OpenAI provider requires apiKey');
        }
        return createOpenAI({ apiKey: config.apiKey });

      case AIProvider.GOOGLE:
        if (!config.apiKey) {
          throw new Error('Google provider requires apiKey');
        }
        return createGoogleGenerativeAI({ apiKey: config.apiKey });

      case AIProvider.OPENROUTER:
        if (!config.apiKey) {
          throw new Error('OpenRouter provider requires apiKey');
        }
        return createOpenRouter({ apiKey: config.apiKey });

      case AIProvider.AZURE:
        if (!config.apiKey || !config.resourceName) {
          throw new Error('Azure provider requires apiKey and resourceName');
        }
        return createAzure({
          resourceName: config.resourceName,
          apiKey: config.apiKey,
        });

      case AIProvider.LMSTUDIO:
        if (!config.baseUrl) {
          throw new Error('LMStudio provider requires baseUrl');
        }
        return createOpenAICompatible({
          name: 'lmstudio',
          baseURL: config.baseUrl,
        });

      case AIProvider.OLLAMA:
        if (!config.baseUrl) {
          throw new Error('Ollama provider requires baseUrl');
        }
        return createOpenAICompatible({
          name: 'ollama',
          baseURL: config.baseUrl,
        });

      case AIProvider.BEDROCK:
        if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
          throw new Error('Bedrock provider requires accessKeyId, secretAccessKey, and region');
        }
        return createAmazonBedrock({
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
        });

      case AIProvider.BROWSEROS:
        if (!config.baseUrl || !config.apiKey) {
          throw new Error('BrowserOS provider requires baseUrl and apiKey');
        }
        return createOpenAICompatible({
          name: 'browseros',
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
        });

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}

// Re-export types for consumers
export { AIProvider };
export type { VercelAIConfig, HonoSSEStream } from './types.js';
