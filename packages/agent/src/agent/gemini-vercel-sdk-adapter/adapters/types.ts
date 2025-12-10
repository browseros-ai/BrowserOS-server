/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Provider Adapter Type Definitions
 * Types for provider-specific metadata handling
 */

/** Base constraint for provider metadata - provider name → provider data */
export type ProviderMetadata = Record<string, Record<string, unknown>>;

/** Function call with optional provider metadata attached */
export interface FunctionCallWithMetadata {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  providerMetadata?: ProviderMetadata;
}
