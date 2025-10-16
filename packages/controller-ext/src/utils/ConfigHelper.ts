/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference path="../types/chrome-browser-os.d.ts" />

import { getBrowserOSAdapter } from '@/adapters/BrowserOSAdapter';
import { logger } from '@/utils/Logger';

const DEFAULT_PORT = 9255;

/**
 * Get the WebSocket port from BrowserOS preferences
 * Returns browseros.server.extension_port preference value
 * Falls back to 9255 if preference cannot be retrieved
 */
export async function getWebSocketPort(): Promise<number> {
  try {
    const adapter = getBrowserOSAdapter();
    const pref = await adapter.getPref('browseros.server.extension_port');

    if (pref && typeof pref.value === 'number') {
      logger.info(`Using port from BrowserOS preferences: ${pref.value}`);
      return pref.value;
    }

    logger.warn(`Port preference not found, using default: ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
  } catch (error) {
    logger.error(`Failed to get port from BrowserOS preferences: ${error}, using default: ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
  }
}
