/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Provider Adapters
 * Factory and exports for provider-specific adapters
 */

import {AIProvider} from '../types.js';

import {BaseProviderAdapter} from './base.js';
import type {ProviderAdapter} from './base.js';
import {GoogleAdapter} from './google.js';
import {OpenRouterAdapter} from './openrouter.js';

/**
 * Create the appropriate adapter for a provider.
 * Returns base adapter (no-op) for providers without special requirements.
 */
export function createProviderAdapter(provider: AIProvider): ProviderAdapter {
  switch (provider) {
    case AIProvider.GOOGLE:
      return new GoogleAdapter();
    case AIProvider.OPENROUTER:
      return new OpenRouterAdapter();
    default:
      return new BaseProviderAdapter();
  }
}

// Re-exports
export type {ProviderAdapter} from './base.js';
export {BaseProviderAdapter} from './base.js';
export {GoogleAdapter} from './google.js';
export {OpenRouterAdapter} from './openrouter.js';
export type {ProviderMetadata, FunctionCallWithMetadata} from './types.js';
