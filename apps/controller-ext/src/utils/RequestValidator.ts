/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ProtocolRequest } from '@/protocol/types'
import { ProtocolRequestSchema } from '@/protocol/types'
import { logger } from './logger'

export class RequestValidator {
  private activeIds = new Set<string>()
  private idTimestamps = new Map<string, number>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Periodically cleanup old IDs (prevent memory leak)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // Every 1 minute
  }

  validate(message: unknown): ProtocolRequest {
    // Step 1: Parse and validate with Zod
    const request = ProtocolRequestSchema.parse(message)

    // Step 2: Check for duplicate ID
    if (this.activeIds.has(request.id)) {
      logger.error(`Duplicate request ID detected: ${request.id}`)
      throw new Error(
        `Duplicate request ID: ${request.id}. Already processing this request.`,
      )
    }

    // Step 3: Track this ID
    this.activeIds.add(request.id)
    this.idTimestamps.set(request.id, Date.now())

    logger.debug(`Request validated: ${request.id} [${request.action}]`)

    return request
  }

  markComplete(id: string): void {
    this.activeIds.delete(id)
    this.idTimestamps.delete(id)
    logger.debug(`Request ID released: ${id}`)
  }

  private cleanup(): void {
    // Remove IDs older than 5 minutes (safety measure in case markComplete() not called)
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000

    for (const [id, timestamp] of this.idTimestamps.entries()) {
      if (timestamp < fiveMinutesAgo) {
        logger.warn(
          `Cleaning up stale request ID: ${id} (age: ${Math.round((now - timestamp) / 1000)}s)`,
        )
        this.activeIds.delete(id)
        this.idTimestamps.delete(id)
      }
    }
  }

  getStats(): { activeIds: number } {
    return {
      activeIds: this.activeIds.size,
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.activeIds.clear()
    this.idTimestamps.clear()
  }
}
