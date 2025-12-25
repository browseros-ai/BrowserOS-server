/**
 * @license
 * Copyright 2025 BrowserOS
 */

import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_LIMITS } from '@browseros/shared/limits'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
interface FormatOptions {
  useColor?: boolean
  truncateStrings?: boolean
}

const COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
}

const RESET = '\x1b[0m'

export class Logger {
  private logFilePath?: string
  private level: LogLevel

  constructor(level: LogLevel = 'info') {
    this.level = level
  }

  setLogFile(logDir: string) {
    this.logFilePath = path.join(logDir, 'browseros-server.log')
  }

  private format(
    level: LogLevel,
    message: string,
    meta?: object,
    { useColor = true, truncateStrings = false }: FormatOptions = {},
  ): string {
    const timestamp = new Date().toISOString()
    const prefix = useColor
      ? `${COLORS[level]}[${timestamp}] [${level.toUpperCase()}]${RESET}`
      : `[${timestamp}] [${level.toUpperCase()}]`
    const metaStr = meta ? `\n${this.stringifyMeta(meta, truncateStrings)}` : ''
    return `${prefix} ${message}${metaStr}`
  }

  private stringifyMeta(meta: object, truncateStrings: boolean): string {
    return JSON.stringify(
      meta,
      (_key, value) => {
        if (
          truncateStrings &&
          typeof value === 'string' &&
          value.length > CONTENT_LIMITS.CONSOLE_META_CHAR
        ) {
          const extra = value.length - CONTENT_LIMITS.CONSOLE_META_CHAR
          return `${value.slice(0, CONTENT_LIMITS.CONSOLE_META_CHAR)}... (+${extra} chars)`
        }
        return value
      },
      2,
    )
  }

  private log(level: LogLevel, message: string, meta?: object) {
    const formatted = this.format(level, message, meta, {
      useColor: true,
      truncateStrings: true,
    })

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

    if (this.logFilePath) {
      const plainFormatted = this.format(level, message, meta, {
        useColor: false,
        truncateStrings: false,
      })
      try {
        fs.appendFileSync(this.logFilePath, `${plainFormatted}\n`)
      } catch (error) {
        console.error(`Failed to write to log file: ${error}`)
      }
    }
  }

  info(message: string, meta?: object) {
    this.log('info', message, meta)
  }

  error(message: string, meta?: object) {
    this.log('error', message, meta)
  }

  warn(message: string, meta?: object) {
    this.log('warn', message, meta)
  }

  debug(message: string, meta?: object) {
    this.log('debug', message, meta)
  }

  setLevel(level: LogLevel) {
    this.level = level
  }
}

export const logger = new Logger()
