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
 * Per SDK docs: uses 'args' property matching ToolCallPart interface
 */
export const VercelToolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(), // Matches ToolCallPart interface
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
 * Note: Property name is 'textDelta' in the actual Vercel AI SDK stream
 */
export const VercelTextDeltaChunkSchema = z.object({
  type: z.literal('text-delta'),
  textDelta: z.string(),
});

/**
 * Tool call chunk from fullStream
 * Note: SDK uses 'args' property matching ToolCallPart interface
 */
export const VercelToolCallChunkSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(), // SDK uses 'args' for both stream chunks and result.toolCalls
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
 * Uses 'args' property per ToolCallPart interface
 */
export interface VercelToolCallPart {
  readonly type: 'tool-call';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: unknown; // SDK uses 'args' for message parts
}

/**
 * Tool result part in tool message
 * Matches Vercel AI SDK's ToolResultPart interface
 */
export interface VercelToolResultPart {
  readonly type: 'tool-result';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly result: unknown; // Direct value from tool execution
}

/**
 * Content part - union of all part types
 */
export type VercelContentPart =
  | VercelTextPart
  | VercelToolCallPart
  | VercelToolResultPart;

// === Tool Definition (What We Build for Vercel) ===

/**
 * Vercel tool definition
 * parameters must be wrapped with jsonSchema() function
 * Note: AI SDK v4 uses 'parameters', v5 uses 'inputSchema'
 */
export interface VercelTool {
  readonly description: string;
  readonly parameters: ReturnType<typeof jsonSchema>;
  readonly execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

// === Helper Types ===

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
}
