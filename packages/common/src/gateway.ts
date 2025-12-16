/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {logger} from './logger.js';
import {telemetry} from './telemetry.js';

export interface Provider {
  name: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface BrowserOSConfig {
  providers: Provider[];
}

export interface LLMConfig {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  provider: Provider;
}

export async function fetchBrowserOSConfig(
  configUrl: string,
): Promise<BrowserOSConfig> {
  logger.debug('Fetching BrowserOS config', {configUrl});

  try {
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch config: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const config = (await response.json()) as BrowserOSConfig;

    if (!Array.isArray(config.providers) || config.providers.length === 0) {
      throw new Error(
        'Invalid config response: providers array is empty or missing',
      );
    }

    for (const provider of config.providers) {
      if (!provider.name || !provider.model || !provider.apiKey) {
        throw new Error('Invalid provider: missing name, model, or apiKey');
      }
    }

    logger.info('✅ BrowserOS config fetched with', {
      count: config.providers.length,
    });

    return config;
  } catch (error) {
    telemetry.captureException(error, {
      context: 'fetchBrowserOSConfig',
      configUrl,
    });
    logger.error('❌ Failed to fetch BrowserOS config', {
      configUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get LLM config from a provider in the BrowserOS config
 * @param config - BrowserOS config containing providers
 * @param providerName - Name of the provider to use (defaults to 'default')
 * @returns LLM config with modelName, baseUrl, apiKey, and provider
 */
export function getLLMConfigFromProvider(
  config: BrowserOSConfig,
  providerName = 'default',
): LLMConfig {
  const provider = config.providers.find(p => p.name === providerName);

  if (!provider) {
    throw new Error(
      `Provider '${providerName}' not found in config. Available providers: ${config.providers.map(p => p.name).join(', ')}`,
    );
  }

  return {
    modelName: provider.model,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    provider,
  };
}
