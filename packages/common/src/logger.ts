/**
 * @license
 * Copyright 2025 BrowserOS
 */
import fs from 'node:fs';
import path from 'node:path';

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
  private logFilePath?: string;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  setLogFile(logDir: string) {
    this.logFilePath = path.join(logDir, 'browseros-server.log');
  }

  private format(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${color}[${timestamp}] [${level.toUpperCase()}]${RESET} ${message}${metaStr}`;
  }

  private formatPlain(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
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

    if (this.logFilePath) {
      const plainFormatted = this.formatPlain(level, message, meta);
      try {
        fs.appendFileSync(this.logFilePath, plainFormatted + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error}`);
      }
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
