/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Type Definitions for Vercel AI Adapter
 * Single source of truth for all types + Zod schemas
 */

import { z } from 'zod';
import { jsonSchema } from 'ai';

// Re-export for use in strategies
export { jsonSchema };

// === Re-export SDK Types ===

// Vercel AI SDK
export type { CoreMessage } from 'ai';
export type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider';

// Gemini SDK
export type {
  Part,
  FunctionCall,
  FunctionDeclaration,
  FunctionResponse,
  Tool,
  Content,
  GenerateContentResponse,
  FinishReason,
} from '@google/genai';

// === Vercel SDK Runtime Shapes (What We Receive) ===

/**
 * Tool call from generateText result
 * Per SDK docs: uses 'input' property matching ToolCallPart interface
 */
export const VercelToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(), // Matches ToolCallPart interface
});

export type VercelToolCall = z.infer<typeof VercelToolCallSchema>;

/**
 * Usage metadata from result
 * All fields can be undefined per SDK types
 * Uses actual SDK property names: promptTokens, completionTokens, totalTokens
 */
export const VercelUsageSchema = z.object({
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
});

export type VercelUsage = z.infer<typeof VercelUsageSchema>;

/**
 * Finish reason from Vercel SDK
 */
export const VercelFinishReasonSchema = z.enum([
  'stop',
  'length',
  'max-tokens',
  'tool-calls',
  'content-filter',
  'error',
  'other',
  'unknown',
]);

export type VercelFinishReason = z.infer<typeof VercelFinishReasonSchema>;

/**
 * GenerateText result shape
 * Only the fields we actually use
 */
export const VercelGenerateTextResultSchema = z.object({
  text: z.string(),
  toolCalls: z.array(VercelToolCallSchema).optional(),
  finishReason: VercelFinishReasonSchema.optional(),
  usage: VercelUsageSchema.optional(),
});

export type VercelGenerateTextResult = z.infer<
  typeof VercelGenerateTextResultSchema
>;

// === Stream Chunk Schemas ===

/**
 * Text delta chunk from fullStream
 * Note: In AI SDK v5, property name is 'text' (was 'textDelta' in v4)
 */
export const VercelTextDeltaChunkSchema = z.object({
  type: z.literal('text-delta'),
  text: z.string(),
});

/**
 * Tool call chunk from fullStream
 * Note: SDK uses 'input' property matching ToolCallPart interface
 */
export const VercelToolCallChunkSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(), // SDK uses 'input' for both stream chunks and result.toolCalls
});

/**
 * Finish chunk from fullStream
 */
export const VercelFinishChunkSchema = z.object({
  type: z.literal('finish'),
  finishReason: VercelFinishReasonSchema.optional(),
});

/**
 * Union of stream chunks we process
 * (SDK emits many other types we ignore)
 */
export const VercelStreamChunkSchema = z.discriminatedUnion('type', [
  VercelTextDeltaChunkSchema,
  VercelToolCallChunkSchema,
  VercelFinishChunkSchema,
]);

export type VercelTextDeltaChunk = z.infer<typeof VercelTextDeltaChunkSchema>;
export type VercelToolCallChunk = z.infer<typeof VercelToolCallChunkSchema>;
export type VercelFinishChunk = z.infer<typeof VercelFinishChunkSchema>;
export type VercelStreamChunk = z.infer<typeof VercelStreamChunkSchema>;

// === Message Content Parts (What We Build for Vercel) ===

/**
 * Text part in message content
 */
export interface VercelTextPart {
  readonly type: 'text';
  readonly text: string;
}

/**
 * Tool call part in assistant message
 * Uses 'input' property per ToolCallPart interface
 */
export interface VercelToolCallPart {
  readonly type: 'tool-call';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown; // SDK uses 'input' for message parts
}

/**
 * Tool result part in tool message
 * Matches Vercel AI SDK v5's ToolResultPart interface
 * Note: output must be structured in v5 (not a raw value)
 */
export interface VercelToolResultPart {
  readonly type: 'tool-result';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly output: LanguageModelV2ToolResultOutput; // v5 requires structured output
}

/**
 * Image part in message content
 * Matches Vercel AI SDK's ImagePart interface
 *
 * Image data can be:
 * - Base64 data URL: "data:image/png;base64,..."
 * - Regular URL: URL object or string
 * - Binary data: Uint8Array, ArrayBuffer, or Buffer
 */
export interface VercelImagePart {
  readonly type: 'image';
  readonly image: string | URL | Uint8Array | ArrayBuffer | Buffer;
  readonly mediaType?: string;
}

/**
 * Content part - union of all part types
 */
export type VercelContentPart =
  | VercelTextPart
  | VercelToolCallPart
  | VercelToolResultPart
  | VercelImagePart;

// === Tool Definition (What We Build for Vercel) ===

/**
 * Vercel tool definition
 * inputSchema must be wrapped with jsonSchema() function
 * Note: AI SDK v5 uses 'inputSchema' (v4 used 'parameters')
 */
export interface VercelTool {
  readonly description: string;
  readonly inputSchema: ReturnType<typeof jsonSchema>;
  readonly execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

// === Helper Types ===

/**
 * Hono Stream interface for direct streaming
 * Minimal interface to avoid Hono dependency in adapter
 */
export interface HonoSSEStream {
  write(data: string): Promise<any>;
}

/**
 * Configuration for Vercel AI adapter
 */
export interface VercelAIConfig {
  model: string;
  apiKeys?: {
    anthropic?: string;
    openai?: string;
    google?: string;
    openrouter?: string;
    azure?: string;
  };
  azureResourceName?: string;
  ollamaBaseUrl?: string;
  lmstudioBaseUrl?: string;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
  honoStream?: HonoSSEStream;
}
