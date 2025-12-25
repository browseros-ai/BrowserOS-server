/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Vercel AI ContentGenerator Implementation
 * Multi-provider LLM adapter using Vercel AI SDK
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ContentGenerator } from '@google/gemini-cli-core'
import type {
  Content,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, streamText } from 'ai'
import { logger } from '../../../common/index.js'
import type { ProviderAdapter } from './adapters/index.js'
import { createProviderAdapter } from './adapters/index.js'
import {
  MessageConversionStrategy,
  ResponseConversionStrategy,
  ToolConversionStrategy,
} from './strategies/index.js'
import type { VercelAIConfig } from './types.js'
import { AIProvider } from './types.js'
import type { UIMessageStreamWriter } from './ui-message-stream.js'
import { createOpenRouterCompatibleFetch } from './utils/index.js'

/**
 * Vercel AI ContentGenerator
 * Implements ContentGenerator interface using strategy pattern for conversions
 */
export class VercelAIContentGenerator implements ContentGenerator {
  private providerInstance: (modelId: string) => unknown
  private model: string
  private uiStream?: UIMessageStreamWriter

  // Provider adapter for provider-specific behavior
  private adapter: ProviderAdapter

  // Conversion strategies
  private toolStrategy: ToolConversionStrategy
  private messageStrategy: MessageConversionStrategy
  private responseStrategy: ResponseConversionStrategy

  constructor(config: VercelAIConfig) {
    this.model = config.model

    // Create provider-specific adapter
    this.adapter = createProviderAdapter(config.provider)

    // Initialize conversion strategies with adapter
    this.toolStrategy = new ToolConversionStrategy()
    this.messageStrategy = new MessageConversionStrategy(this.adapter)
    this.responseStrategy = new ResponseConversionStrategy(
      this.toolStrategy,
      this.adapter,
    )

    // Register the single provider from config
    this.providerInstance = this.createProvider(config)
  }

  /**
   * Set/override the UIMessageStreamWriter for the current request
   * This ensures a single writer manages the stream lifecycle across all turns
   */
  setUIStream(writer: UIMessageStreamWriter | undefined): void {
    this.uiStream = writer
  }

  /**
   * Non-streaming content generation
   */
  // @ts-expect-error Intentional override of gemini-cli-core's ContentGenerator to use Vercel AI SDK
  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const contents = (
      Array.isArray(request.contents) ? request.contents : [request.contents]
    ) as Content[]
    const messages = this.messageStrategy.geminiToVercel(contents)
    const tools = this.toolStrategy.geminiToVercel(request.config?.tools)

    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    )

    const result = await generateText({
      model: this.providerInstance(this.model) as Parameters<
        typeof generateText
      >[0]['model'],
      messages,
      system,
      tools,
      temperature: request.config?.temperature,
      abortSignal: request.config?.abortSignal,
    })

    return this.responseStrategy.vercelToGemini(result)
  }

  /**
   * Streaming content generation
   */
  // @ts-expect-error Intentional override of gemini-cli-core's ContentGenerator to use Vercel AI SDK
  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Reset adapter state before each stream
    this.adapter.reset()

    const contents = (
      Array.isArray(request.contents) ? request.contents : [request.contents]
    ) as Content[]
    const messages = this.messageStrategy.geminiToVercel(contents)
    const tools = this.toolStrategy.geminiToVercel(request.config?.tools)
    const system = this.messageStrategy.convertSystemInstruction(
      request.config?.systemInstruction,
    )

    const result = streamText({
      model: this.providerInstance(this.model) as Parameters<
        typeof streamText
      >[0]['model'],
      messages,
      system,
      tools,
      temperature: request.config?.temperature,
      abortSignal: request.config?.abortSignal,
    })

    // Estimate prompt tokens from ALL request components (system + tools + contents)
    // This must match what the LLM actually receives to avoid compression failures
    const systemTokens = system ? Math.ceil(system.length / 4) : 0
    const toolsTokens = tools ? Math.ceil(JSON.stringify(tools).length / 4) : 0
    const contentsTokens = Math.ceil(JSON.stringify(contents).length / 4)
    const estimatedPromptTokens = systemTokens + toolsTokens + contentsTokens

    return this.responseStrategy.streamToGemini(
      result.fullStream,
      async () => {
        try {
          const usage = await result.usage
          // AI SDK returns LanguageModelUsage: inputTokens, outputTokens, totalTokens
          const rawUsage = usage as {
            inputTokens?: number
            outputTokens?: number
            totalTokens?: number
            reasoningTokens?: number
            cachedInputTokens?: number
          }

          const inputTokens = rawUsage.inputTokens
          const outputTokens = rawUsage.outputTokens ?? 0
          const totalTokens =
            rawUsage.totalTokens ?? (inputTokens ?? 0) + outputTokens

          return {
            // Use actual value if available, otherwise estimate from request contents
            inputTokens:
              inputTokens && inputTokens > 0
                ? inputTokens
                : estimatedPromptTokens,
            outputTokens,
            totalTokens:
              inputTokens && inputTokens > 0
                ? totalTokens
                : estimatedPromptTokens + outputTokens,
          }
        } catch (err) {
          logger.debug('Usage fetch failed, using estimate', {
            error: String(err),
            estimated: {
              system: systemTokens,
              tools: toolsTokens,
              contents: contentsTokens,
              total: estimatedPromptTokens,
            },
          })
          return {
            inputTokens: estimatedPromptTokens,
            outputTokens: 0,
            totalTokens: estimatedPromptTokens,
          }
        }
      },
      this.uiStream,
    )
  }

  /**
   * Count tokens (estimation)
   */
  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Rough estimation: 1 token ≈ 4 characters
    const text = JSON.stringify(request.contents)
    const estimatedTokens = Math.ceil(text.length / 4)

    return {
      totalTokens: estimatedTokens,
    }
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
    )
  }

  /**
   * Create provider instance based on config
   */
  private createProvider(config: VercelAIConfig): (modelId: string) => unknown {
    switch (config.provider) {
      case AIProvider.ANTHROPIC:
        if (!config.apiKey) {
          throw new Error('Anthropic provider requires apiKey')
        }
        return createAnthropic({ apiKey: config.apiKey })

      case AIProvider.OPENAI:
        if (!config.apiKey) {
          throw new Error('OpenAI provider requires apiKey')
        }
        return createOpenAI({ apiKey: config.apiKey })

      case AIProvider.GOOGLE:
        if (!config.apiKey) {
          throw new Error('Google provider requires apiKey')
        }
        return createGoogleGenerativeAI({ apiKey: config.apiKey })

      case AIProvider.OPENROUTER:
        if (!config.apiKey) {
          throw new Error('OpenRouter provider requires apiKey')
        }
        return createOpenRouter({
          apiKey: config.apiKey,
          extraBody: {
            reasoning: {}, // Enable reasoning for Gemini 3 thought signatures
          },
          fetch: createOpenRouterCompatibleFetch(),
        })

      case AIProvider.AZURE:
        if (!config.apiKey || !config.resourceName) {
          throw new Error('Azure provider requires apiKey and resourceName')
        }
        return createAzure({
          resourceName: config.resourceName,
          apiKey: config.apiKey,
        })

      case AIProvider.LMSTUDIO:
        if (!config.baseUrl) {
          throw new Error('LMStudio provider requires baseUrl')
        }
        return createOpenAICompatible({
          name: 'lmstudio',
          baseURL: config.baseUrl,
          ...(config.apiKey && { apiKey: config.apiKey }),
        })

      case AIProvider.OLLAMA:
        if (!config.baseUrl) {
          throw new Error('Ollama provider requires baseUrl')
        }
        return createOpenAICompatible({
          name: 'ollama',
          baseURL: config.baseUrl,
          ...(config.apiKey && { apiKey: config.apiKey }),
        })

      case AIProvider.BEDROCK:
        if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
          throw new Error(
            'Bedrock provider requires accessKeyId, secretAccessKey, and region',
          )
        }
        return createAmazonBedrock({
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
        })

      case AIProvider.BROWSEROS:
        if (!config.baseUrl) {
          throw new Error('BrowserOS provider requires baseUrl')
        }
        // Use native SDK based on upstream provider type from ai-gateway
        switch (config.upstreamProvider) {
          case AIProvider.OPENROUTER:
            return createOpenRouter({
              baseURL: config.baseUrl,
              ...(config.apiKey && { apiKey: config.apiKey }),
              fetch: createOpenRouterCompatibleFetch(),
            })
          case AIProvider.ANTHROPIC:
            return createAnthropic({
              baseURL: config.baseUrl,
              ...(config.apiKey && { apiKey: config.apiKey }),
            })
          case AIProvider.AZURE:
            return createAzure({
              baseURL: config.baseUrl,
              ...(config.apiKey && { apiKey: config.apiKey }),
            })
          default:
            // Fallback to OpenAI-compatible SDK
            logger.info('creating openai-compatible')
            return createOpenAICompatible({
              name: 'browseros',
              baseURL: config.baseUrl,
              ...(config.apiKey && { apiKey: config.apiKey }),
            })
        }

      case AIProvider.OPENAI_COMPATIBLE:
        if (!config.baseUrl) {
          throw new Error('OpenAI-compatible provider requires baseUrl')
        }
        return createOpenAICompatible({
          name: 'openai-compatible',
          baseURL: config.baseUrl,
          ...(config.apiKey && { apiKey: config.apiKey }),
        })

      default:
        throw new Error(`Unknown provider: ${config.provider}`)
    }
  }
}

// Re-export types for consumers
export { AIProvider }
export type { ProviderTestResult } from './testProvider.js'
export { testProviderConnection } from './testProvider.js'
export type { HonoSSEStream, VercelAIConfig } from './types.js'
