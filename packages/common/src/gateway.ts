/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {logger} from './logger.js';

export interface BrowserOSConfig {
  model: string;
  apiKey: string;
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

    if (!config.model || !config.apiKey) {
      throw new Error('Invalid config response: missing model or apiKey');
    }

    logger.info('✅ BrowserOS config fetched');

    return config;
  } catch (error) {
    logger.error('❌ Failed to fetch BrowserOS config', {
      configUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
