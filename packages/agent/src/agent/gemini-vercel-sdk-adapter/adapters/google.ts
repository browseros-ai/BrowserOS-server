/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Google Provider Adapter
 * Handles Gemini 3 thoughtSignature round-trip for multi-step function calling.
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */

import {BaseProviderAdapter} from './base.js';
import type {ProviderMetadata, FunctionCallWithMetadata} from './types.js';

type StreamChunk = {
  type?: string;
  providerMetadata?: {
    google?: {thoughtSignature?: string; [key: string]: unknown};
  };
  rawValue?: {
    candidates?: Array<{
      content?: {parts?: Array<{thoughtSignature?: string}>};
    }>;
  };
};

export class GoogleAdapter extends BaseProviderAdapter {
  private thoughtSignature: string | undefined;
  private googleMetadata: Record<string, unknown> = {};

  override processStreamChunk(chunk: unknown): void {
    const c = chunk as StreamChunk;

    // Extract from providerMetadata (standard AI SDK format)
    const googleMeta = c.providerMetadata?.google;
    if (googleMeta) {
      if (googleMeta.thoughtSignature) {
        this.thoughtSignature = googleMeta.thoughtSignature;
      }
      this.googleMetadata = {...this.googleMetadata, ...googleMeta};
    }

    // Extract from raw response format
    for (const candidate of c.rawValue?.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.thoughtSignature) {
          this.thoughtSignature = part.thoughtSignature;
        }
      }
    }
  }

  override getResponseMetadata(): ProviderMetadata | undefined {
    if (!this.thoughtSignature && !Object.keys(this.googleMetadata).length) {
      return undefined;
    }
    return {
      google: {
        ...(this.thoughtSignature && {thoughtSignature: this.thoughtSignature}),
        ...this.googleMetadata,
      },
    };
  }

  override getToolCallProviderOptions(
    fc: FunctionCallWithMetadata,
  ): ProviderMetadata | undefined {
    return fc.providerMetadata;
  }

  override reset(): void {
    this.thoughtSignature = undefined;
    this.googleMetadata = {};
  }
}
