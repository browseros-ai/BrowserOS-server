/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type {Database} from 'bun:sqlite';

import {logger} from '@browseros/common';

import {RateLimitError} from './errors.js';

const DEFAULT_DAILY_RATE_LIMIT = 5;

export interface RecordParams {
  conversationId: string;
  browserosId: string;
  provider: string;
}

export class RateLimiter {
  private countStmt: ReturnType<Database['prepare']>;
  private insertStmt: ReturnType<Database['prepare']>;
  private dailyRateLimit: number;

  constructor(
    private db: Database,
    dailyRateLimit: number = DEFAULT_DAILY_RATE_LIMIT,
  ) {
    this.dailyRateLimit = dailyRateLimit;
    this.countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM rate_limiter
      WHERE browseros_id = ?
        AND date(created_at) = date('now')
    `);

    // INSERT OR IGNORE: duplicate conversation_ids are silently ignored
    // This ensures the same conversation is only counted once for rate limiting
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO rate_limiter
        (id, browseros_id, provider)
      VALUES (?, ?, ?)
    `);
  }

  check(browserosId: string): void {
    const count = this.getTodayCount(browserosId);
    if (count >= this.dailyRateLimit) {
      logger.warn('Rate limit exceeded', {
        browserosId,
        count,
        dailyRateLimit: this.dailyRateLimit,
      });
      throw new RateLimitError(count, this.dailyRateLimit);
    }
  }

  record(params: RecordParams): void {
    const {conversationId, browserosId, provider} = params;
    this.insertStmt.run(conversationId, browserosId, provider);
  }

  private getTodayCount(browserosId: string): number {
    const row = this.countStmt.get(browserosId) as {count: number} | null;
    return row?.count ?? 0;
  }
}

export {RateLimitError} from './errors.js';
