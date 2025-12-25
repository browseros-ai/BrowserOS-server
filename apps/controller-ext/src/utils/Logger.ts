/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { LoggerInterface, LogLevel } from '@browseros/shared/logger'
import { LOGGING_CONFIG } from '@/config/constants'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export class Logger implements LoggerInterface {
  private prefix: string

  constructor(prefix: string = LOGGING_CONFIG.prefix) {
    this.prefix = prefix
  }

  private shouldLog(level: LogLevel): boolean {
    if (!LOGGING_CONFIG.enabled) return false
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOGGING_CONFIG.level]
  }

  private formatMessage(message: string): string {
    const timestamp = new Date().toISOString()
    return `${this.prefix} [${timestamp}] ${message}`
  }

  private formatData(data?: Record<string, unknown>): string {
    return data ? `\n${JSON.stringify(data, null, 2)}` : ''
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    console.log(this.formatMessage(message) + this.formatData(data))
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    console.info(this.formatMessage(message) + this.formatData(data))
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage(message) + this.formatData(data))
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return
    console.error(this.formatMessage(message) + this.formatData(data))
  }
}

export const logger = new Logger()
