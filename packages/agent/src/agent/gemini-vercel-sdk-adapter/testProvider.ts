/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Provider Connection Test
 * Tests that a provider configuration works by making a minimal LLM call
 * through the full VercelAIContentGenerator pipeline.
 */

import type {Content} from '@google/genai';

import type {VercelAIConfig} from './types.js';

import {VercelAIContentGenerator} from './index.js';

export interface ProviderTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
}

const TEST_PROMPT = "Respond with exactly: 'ok'";
const TEST_TIMEOUT_MS = 15000;

/**
 * Test a provider connection by making a minimal generateContent call.
 * This exercises the full pipeline: provider creation, message conversion,
 * LLM call, and response conversion.
 */
export async function testProviderConnection(
  config: VercelAIConfig,
): Promise<ProviderTestResult> {
  const startTime = performance.now();

  try {
    const generator = new VercelAIContentGenerator(config);

    const contents: Content[] = [
      {
        role: 'user',
        parts: [{text: TEST_PROMPT}],
      },
    ];

    const response = await generator.generateContent(
      {
        model: config.model, // Required by type but ignored - class uses its own model
        contents,
        config: {
          abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
        },
      },
      'provider-test',
    );

    const responseTime = Math.round(performance.now() - startTime);

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const text = part && 'text' in part ? (part.text as string) : null;

    if (text) {
      const preview = text.length > 100 ? `${text.slice(0, 100)}...` : text;
      return {
        success: true,
        message: `Connection successful. Response: "${preview}"`,
        responseTime,
      };
    }

    return {
      success: true,
      message: 'Connection successful. Provider responded.',
      responseTime,
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    if (error instanceof Error) {
      return {
        success: false,
        message: parseProviderError(error),
        responseTime,
      };
    }

    return {
      success: false,
      message: 'An unexpected error occurred',
      responseTime,
    };
  }
}

function parseProviderError(error: Error): string {
  const msg = error.message;
  const msgLower = msg.toLowerCase();

  // Authentication errors
  if (
    msgLower.includes('401') ||
    msgLower.includes('unauthorized') ||
    msgLower.includes('invalid api key') ||
    msgLower.includes('invalid_api_key') ||
    msgLower.includes('authentication')
  ) {
    return 'Authentication failed: Invalid API key';
  }

  // Permission errors
  if (msgLower.includes('403') || msgLower.includes('forbidden')) {
    return 'Access denied: Check API key permissions';
  }

  // Model not found
  if (
    msgLower.includes('404') ||
    msgLower.includes('not found') ||
    msgLower.includes('does not exist') ||
    msgLower.includes('invalid model')
  ) {
    return 'Model not found: Verify the model ID is correct';
  }

  // Rate limits
  if (
    msgLower.includes('429') ||
    msgLower.includes('rate limit') ||
    msgLower.includes('too many requests') ||
    msgLower.includes('quota')
  ) {
    return 'Rate limit exceeded: Try again later';
  }

  // Timeout
  if (
    msgLower.includes('timeout') ||
    msgLower.includes('aborted') ||
    error.name === 'TimeoutError' ||
    error.name === 'AbortError'
  ) {
    return `Connection timed out after ${TEST_TIMEOUT_MS / 1000}s`;
  }

  // Network errors
  if (
    msgLower.includes('econnrefused') ||
    msgLower.includes('enotfound') ||
    msgLower.includes('network') ||
    msgLower.includes('fetch failed') ||
    msgLower.includes('failed to fetch')
  ) {
    return 'Network error: Unable to reach provider';
  }

  // Server errors
  if (msgLower.includes('500') || msgLower.includes('internal server error')) {
    return 'Provider server error: Try again later';
  }

  if (msgLower.includes('502') || msgLower.includes('bad gateway')) {
    return 'Provider temporarily unavailable (502)';
  }

  if (msgLower.includes('503') || msgLower.includes('service unavailable')) {
    return 'Provider service unavailable (503)';
  }

  // Provider-specific validation errors from createProvider()
  // These are already user-friendly: "Azure provider requires apiKey and resourceName"
  if (msg.includes('requires')) {
    return msg;
  }

  return `Error: ${msg}`;
}
