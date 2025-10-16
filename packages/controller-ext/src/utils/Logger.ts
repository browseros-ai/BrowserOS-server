
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { LOGGING_CONFIG } from '@/config/constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private prefix: string;

  constructor(prefix: string = LOGGING_CONFIG.prefix) {
    this.prefix = prefix;
  }

  log(message: string, level: LogLevel = 'info'): void {
    if (!LOGGING_CONFIG.enabled) return;

    const timestamp = new Date().toISOString();
    const logMessage = `${this.prefix} [${timestamp}] ${message}`;

    switch (level) {
      case 'debug':
        if (LOGGING_CONFIG.level === 'debug') console.log(logMessage);
        break;
      case 'info':
        if (['debug', 'info'].includes(LOGGING_CONFIG.level)) console.info(logMessage);
        break;
      case 'warn':
        if (['debug', 'info', 'warn'].includes(LOGGING_CONFIG.level)) console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  debug(message: string): void {
    this.log(message, 'debug');
  }

  info(message: string): void {
    this.log(message, 'info');
  }

  warn(message: string): void {
    this.log(message, 'warn');
  }

  error(message: string): void {
    this.log(message, 'error');
  }
}

// Global logger instance
export const logger = new Logger();
