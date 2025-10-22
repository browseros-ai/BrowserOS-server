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

export class Logger {
  private static instance: Logger;
  private level: LogLevel;

  private constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
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

  static info(message: string, meta?: object) {
    Logger.getInstance().log('info', message, meta);
  }

  static error(message: string, meta?: object) {
    Logger.getInstance().log('error', message, meta);
  }

  static warn(message: string, meta?: object) {
    Logger.getInstance().log('warn', message, meta);
  }

  static debug(message: string, meta?: object) {
    Logger.getInstance().log('debug', message, meta);
  }

  static setLevel(level: LogLevel) {
    Logger.getInstance().level = level;
  }
}

export const logger = Logger;
