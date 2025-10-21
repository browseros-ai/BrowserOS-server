/**
 * @license
 * Copyright 2025 BrowserOS
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const COLORS = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m'   // Red
}

const RESET = '\x1b[0m'

/**
 * Logger singleton for consistent logging across the application
 *
 * Usage:
 *   import { Logger } from './utils/Logger.js'
 *   Logger.info('message', { meta: 'data' })
 */
export class Logger {
  private static instance: Logger
  private level: LogLevel

  private constructor(level: LogLevel = 'info') {
    this.level = level
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private format(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString()
    const color = COLORS[level]
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `${color}[${timestamp}] [${level.toUpperCase()}]${RESET} ${message}${metaStr}`
  }

  private log(level: LogLevel, message: string, meta?: object) {
    const formatted = this.format(level, message, meta)

    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      default:
        console.log(formatted)
    }
  }

  /**
   * Log info message
   */
  static info(message: string, meta?: object) {
    Logger.getInstance().log('info', message, meta)
  }

  /**
   * Log error message
   */
  static error(message: string, meta?: object) {
    Logger.getInstance().log('error', message, meta)
  }

  /**
   * Log warning message
   */
  static warn(message: string, meta?: object) {
    Logger.getInstance().log('warn', message, meta)
  }

  /**
   * Log debug message
   */
  static debug(message: string, meta?: object) {
    Logger.getInstance().log('debug', message, meta)
  }

  /**
   * Set log level
   */
  static setLevel(level: LogLevel) {
    Logger.getInstance().level = level
  }
}
