/**
 * @license
 * Copyright 2025 BrowserOS
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private format(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${color}[${timestamp}] [${level.toUpperCase()}]${RESET} ${message}${metaStr}`;
  }

  private log(level: LogLevel, message: string, meta?: object) {
    const formatted = this.format(level, message, meta);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  info(message: string, meta?: object) {
    this.log('info', message, meta);
  }

  error(message: string, meta?: object) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: object) {
    this.log('warn', message, meta);
  }

  debug(message: string, meta?: object) {
    this.log('debug', message, meta);
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }
}

export const logger = new Logger();
