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
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: `[${config.provider}] ${errorMsg}`,
      responseTime,
    };
  }
}
