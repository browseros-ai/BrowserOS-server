/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * OpenRouter Provider Adapter
 * Handles Gemini 3 Pro reasoning metadata round-trip:
 * - Accumulates reasoning_details from response stream chunks
 * - Attaches metadata to function call parts for storage
 * - Extracts metadata for injection into subsequent requests
 */

import {z} from 'zod';

import {BaseProviderAdapter} from './base.js';
import type {ProviderMetadata, FunctionCallWithMetadata} from './types.js';

/**
 * OpenRouter reasoning chunk schema
 * Uses .passthrough() to preserve all fields from the provider
 */
const OpenRouterReasoningChunkSchema = z.object({
  type: z.enum(['reasoning-delta', 'reasoning-start']),
  providerMetadata: z.object({
    openrouter: z.object({
      reasoning_details: z.array(z.unknown()),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough();

export class OpenRouterAdapter extends BaseProviderAdapter {
  private reasoningDetails: unknown[] = [];

  override processStreamChunk(chunk: unknown): void {
    const parsed = OpenRouterReasoningChunkSchema.safeParse(chunk);
    if (!parsed.success) return;

    const details = parsed.data.providerMetadata?.openrouter?.reasoning_details;
    if (details && Array.isArray(details)) {
      this.reasoningDetails.push(...details);
    }
  }

  override getResponseMetadata(): ProviderMetadata | undefined {
    if (this.reasoningDetails.length === 0) return undefined;

    return {
      openrouter: {
        reasoning_details: this.reasoningDetails,
      },
    };
  }

  override getToolCallProviderOptions(fc: FunctionCallWithMetadata): ProviderMetadata | undefined {
    return fc.providerMetadata;
  }

  override reset(): void {
    this.reasoningDetails = [];
  }
}
