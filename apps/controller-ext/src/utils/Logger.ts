/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {LOGGING_CONFIG} from '@/config/constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private prefix: string;

  constructor(prefix: string = LOGGING_CONFIG.prefix) {
    this.prefix = prefix;
  }

  log(message: string, level: LogLevel = 'info', data?: object): void {
    if (!LOGGING_CONFIG.enabled) return;

    const timestamp = new Date().toISOString();
    const logMessage = `${this.prefix} [${timestamp}] ${message}`;
    const formattedData = data ? `\n${JSON.stringify(data, null, 2)}` : '';

    switch (level) {
      case 'debug':
        if (LOGGING_CONFIG.level === 'debug')
          console.log(logMessage + formattedData);
        break;
      case 'info':
        if (['debug', 'info'].includes(LOGGING_CONFIG.level))
          console.info(logMessage + formattedData);
        break;
      case 'warn':
        if (['debug', 'info', 'warn'].includes(LOGGING_CONFIG.level))
          console.warn(logMessage + formattedData);
        break;
      case 'error':
        console.error(logMessage + formattedData);
        break;
    }
  }

  debug(message: string, data?: object): void {
    this.log(message, 'debug', data);
  }

  info(message: string, data?: object): void {
    this.log(message, 'info', data);
  }

  warn(message: string, data?: object): void {
    this.log(message, 'warn', data);
  }

  error(message: string, data?: object): void {
    this.log(message, 'error', data);
  }
}

// Global logger instance
export const logger = new Logger();
