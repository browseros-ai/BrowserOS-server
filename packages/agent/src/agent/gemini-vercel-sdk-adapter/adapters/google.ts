/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Google Provider Adapter
 * Handles Gemini 3 thoughtSignature round-trip:
 * - Extracts thoughtSignature from response stream chunks
 * - Attaches metadata to function call parts for storage
 * - Extracts metadata for injection into subsequent requests
 *
 * Required for Gemini 3 models which mandate thoughtSignature
 * to be passed back during multi-step function calling.
 *
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */

import {z} from 'zod';

import {BaseProviderAdapter} from './base.js';
import type {ProviderMetadata, FunctionCallWithMetadata} from './types.js';

/**
 * Schema for Google provider metadata in stream chunks
 * Handles both thinking chunks and tool-call chunks with thoughtSignature
 */
const GoogleStreamChunkSchema = z
  .object({
    type: z.string().optional(),
    providerMetadata: z
      .object({
        google: z
          .object({
            thoughtSignature: z.string().optional(),
            // Preserve other Google-specific fields
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/**
 * Schema for raw response chunks that may contain thoughtSignature
 * These come through when the SDK emits raw provider responses
 */
const GoogleRawChunkSchema = z
  .object({
    type: z.literal('raw').optional(),
    rawValue: z
      .object({
        candidates: z
          .array(
            z
              .object({
                content: z
                  .object({
                    parts: z
                      .array(
                        z
                          .object({
                            thought: z.boolean().optional(),
                            thoughtSignature: z.string().optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export class GoogleAdapter extends BaseProviderAdapter {
  private thoughtSignature: string | undefined;
  private googleMetadata: Record<string, unknown> = {};

  override processStreamChunk(chunk: unknown): void {
    // Try to extract from providerMetadata (standard AI SDK format)
    const parsed = GoogleStreamChunkSchema.safeParse(chunk);
    if (parsed.success) {
      const googleMeta = parsed.data.providerMetadata?.google;
      if (googleMeta) {
        if (googleMeta.thoughtSignature) {
          this.thoughtSignature = googleMeta.thoughtSignature;
        }
        // Preserve all Google metadata
        this.googleMetadata = {...this.googleMetadata, ...googleMeta};
      }
    }

    // Also try to extract from raw response format
    const rawParsed = GoogleRawChunkSchema.safeParse(chunk);
    if (rawParsed.success && rawParsed.data.rawValue?.candidates) {
      for (const candidate of rawParsed.data.rawValue.candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.thoughtSignature) {
            this.thoughtSignature = part.thoughtSignature;
          }
        }
      }
    }
  }

  override getResponseMetadata(): ProviderMetadata | undefined {
    if (
      !this.thoughtSignature &&
      Object.keys(this.googleMetadata).length === 0
    ) {
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
    // Return stored provider metadata to be passed back in subsequent requests
    // This ensures thoughtSignature is included when sending function responses
    return fc.providerMetadata;
  }

  override reset(): void {
    this.thoughtSignature = undefined;
    this.googleMetadata = {};
  }
}
