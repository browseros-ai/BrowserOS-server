/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference path="../types/chrome-browser-os.d.ts" />

import { getBrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { WEBSOCKET_CONFIG } from '@/config/constants'
import { logger } from '@/utils/logger'

/**
 * Get the WebSocket port from BrowserOS preferences
 * Returns browseros.server.extension_port preference value
 * Falls back to port from constants if preference cannot be retrieved
 */
export async function getWebSocketPort(): Promise<number> {
  try {
    const adapter = getBrowserOSAdapter()
    const pref = await adapter.getPref('browseros.server.extension_port')

    if (pref && typeof pref.value === 'number') {
      logger.info(`Using port from BrowserOS preferences: ${pref.value}`)
      return pref.value
    }

    logger.warn(
      `Port preference not found, using default: ${WEBSOCKET_CONFIG.defaultExtensionPort}`,
    )
    return WEBSOCKET_CONFIG.defaultExtensionPort
  } catch (error) {
    logger.error(
      `Failed to get port from BrowserOS preferences: ${error}, using default: ${WEBSOCKET_CONFIG.defaultExtensionPort}`,
    )
    return WEBSOCKET_CONFIG.defaultExtensionPort
  }
}
