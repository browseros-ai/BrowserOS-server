/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from '@/utils/Logger';

const KEEPALIVE_ALARM_NAME = 'browseros-keepalive';
const KEEPALIVE_INTERVAL_MINUTES = 0.33; // ~20 seconds

export class KeepAlive {
  private static isInitialized = false;

  static async start(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('KeepAlive already started');
      return;
    }

    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === KEEPALIVE_ALARM_NAME) {
        logger.debug('KeepAlive: ping (service worker alive)');
      }
    });

    await chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
      periodInMinutes: KEEPALIVE_INTERVAL_MINUTES,
    });

    this.isInitialized = true;
    logger.info(
      `KeepAlive started: alarm every ${KEEPALIVE_INTERVAL_MINUTES * 60}s`,
    );
  }

  static async stop(): Promise<void> {
    await chrome.alarms.clear(KEEPALIVE_ALARM_NAME);
    this.isInitialized = false;
    logger.info('KeepAlive stopped');
  }
}
