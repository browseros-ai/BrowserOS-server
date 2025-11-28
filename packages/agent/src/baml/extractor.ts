/**
 * BAML Structured Data Extractor
 *
 * Uses BAML's Modular API for structured output extraction:
 * - b.request.Extract() → Renders prompt with schema via ctx.output_format()
 * - VercelAIContentGenerator → Makes LLM call with any provider
 * - b.parse.Extract() → Parses response with SAP (~99% success rate)
 *
 * This approach leverages BAML's SAP parsing without configuring BAML's HTTP client.
 */

import { logger } from '@browseros/common';
import { VercelAIContentGenerator } from '../agent/gemini-vercel-sdk-adapter/index.js';
import type { VercelAIConfig } from '../agent/gemini-vercel-sdk-adapter/types.js';
import { jsonSchemaToBAML, type JSONSchema } from './schemaConverter.js';

// ============================================================================
// BAML Client Types (loaded dynamically)
// ============================================================================

interface ContentPart {
  type: 'text';
  text: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface RequestBody {
  model: string;
  messages: Message[];
}

interface HTTPRequest {
  body: {
    json: () => RequestBody;
  };
}

interface BAMLOptions {
  tb?: TypeBuilderInstance;
  env?: Record<string, string>;
}

interface ParsedResponse {
  data?: unknown;
}

interface TypeBuilderInstance {
  addBaml: (code: string) => void;
}

interface TypeBuilderConstructor {
  new (): TypeBuilderInstance;
}

interface BAMLClient {
  request: {
    Extract: (query: string, content: string, options: BAMLOptions) => Promise<HTTPRequest>;
  };
  parse: {
    Extract: (llmResponse: string, options: BAMLOptions) => ParsedResponse;
  };
}

// ============================================================================
// Extractor Implementation
// ============================================================================

export class BAMLExtractor {
  private initialized = false;
  private b!: BAMLClient;
  private TypeBuilder!: TypeBuilderConstructor;

  /**
   * Initialize BAML client (lazy loaded)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const bamlClient = await import('./baml_client/index.js');
      const typeBuilder = await import('./baml_client/type_builder.js');

      this.b = bamlClient.b as BAMLClient;
      this.TypeBuilder = typeBuilder.default as TypeBuilderConstructor;
      this.initialized = true;

      logger.info('BAML Extractor initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize BAML client', { error: message });
      throw new Error(
        'BAML client not found. Run `bunx baml-cli generate` in packages/agent/src/baml'
      );
    }
  }

  /**
   * Extract text content from message (handles both string and ContentPart[])
   */
  private extractMessageContent(content: string | ContentPart[]): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
  }

  /**
   * Extract prompt from BAML HTTPRequest body
   */
  private extractPrompt(body: RequestBody): string {
    const parts: string[] = [];

    for (const msg of body.messages) {
      if (msg.role === 'system' || msg.role === 'user') {
        const text = this.extractMessageContent(msg.content);
        if (text) parts.push(text);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Extract structured data from content using JSON Schema
   *
   * @param query - Original user query (provides context for extraction)
   * @param content - Content to extract from (e.g., LLM response)
   * @param schema - JSON Schema defining the structure to extract
   * @param providerConfig - Vercel AI SDK provider configuration
   * @returns Extracted structured data matching the schema
   *
   * @example
   * const result = await extractor.extract(
   *   "What are the product details?",
   *   "The MacBook Pro costs $1999 and is in stock.",
   *   { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' } } },
   *   { provider: AIProvider.OPENAI, model: 'gpt-4o', apiKey: '...' }
   * );
   */
  async extract(
    query: string,
    content: string,
    schema: JSONSchema,
    providerConfig: VercelAIConfig,
    rootClassName = 'ExtractedData'
  ): Promise<unknown> {
    await this.initialize();

    // 1. Build TypeBuilder with dynamic schema
    const bamlCode = jsonSchemaToBAML(schema, rootClassName);
    const tb = new this.TypeBuilder();

    try {
      tb.addBaml(bamlCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse BAML schema', { error: message, bamlCode });
      throw new Error(`Invalid BAML schema: ${message}`);
    }

    // 2. Get rendered prompt from BAML
    // Uses dummy env since we only need the prompt, not HTTP headers
    const dummyEnv = {
      BAML_OPENAI_API_KEY: 'dummy-for-prompt-rendering',
      BAML_OPENAI_MODEL: 'gpt-4o',
    };

    const httpRequest = await this.b.request.Extract(query, content, { tb, env: dummyEnv });
    const prompt = this.extractPrompt(httpRequest.body.json());

    logger.debug('BAML prompt rendered', {
      promptLength: prompt.length,
      provider: providerConfig.provider,
    });

    // 3. Call LLM via Vercel AI SDK
    const contentGenerator = new VercelAIContentGenerator(providerConfig);
    const llmResponse = await contentGenerator.generateTextFromPrompt(prompt);

    logger.debug('LLM response received', {
      responseLength: llmResponse.length,
      provider: providerConfig.provider,
    });

    // 4. Parse with BAML SAP
    const parsed = this.b.parse.Extract(llmResponse, { tb });

    logger.debug('BAML SAP parsing complete', {
      hasData: !!parsed?.data,
      provider: providerConfig.provider,
    });

    return parsed?.data ?? parsed;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: BAMLExtractor | null = null;

export function getBAMLExtractor(): BAMLExtractor {
  if (!instance) {
    instance = new BAMLExtractor();
  }
  return instance;
}
