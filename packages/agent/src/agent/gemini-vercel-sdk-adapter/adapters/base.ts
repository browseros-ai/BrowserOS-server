/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Base Provider Adapter
 * Provides no-op defaults for all methods. Extend and override only what you need.
 */

import type {ProviderMetadata, FunctionCallWithMetadata} from './types.js';

/**
 * Provider Adapter Interface
 * Hook points for provider-specific behavior across conversion strategies.
 */
export interface ProviderAdapter {
  /** Process each stream chunk. Use for accumulating provider metadata. */
  processStreamChunk(chunk: unknown): void;

  /** Get metadata to attach to function call parts in response. */
  getResponseMetadata(): ProviderMetadata | undefined;

  /** Extract provider options from stored function call for outbound requests. */
  getToolCallProviderOptions(fc: FunctionCallWithMetadata): ProviderMetadata | undefined;

  /** Transform provider error into normalized error. */
  normalizeError(error: unknown): Error;

  /** Reset state between conversation turns. */
  reset(): void;
}

/**
 * Base Provider Adapter
 * Default no-op implementation. Serves as the adapter for providers without special needs.
 */
export class BaseProviderAdapter implements ProviderAdapter {
  processStreamChunk(_chunk: unknown): void {
    // No-op: Most providers don't need chunk processing
  }

  getResponseMetadata(): ProviderMetadata | undefined {
    return undefined;
  }

  getToolCallProviderOptions(_fc: FunctionCallWithMetadata): ProviderMetadata | undefined {
    return undefined;
  }

  normalizeError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }

  reset(): void {
    // No-op: No state to reset
  }
}
