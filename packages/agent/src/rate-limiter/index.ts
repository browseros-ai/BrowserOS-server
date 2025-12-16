/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type {Database} from 'bun:sqlite';

import {logger} from '@browseros/common';

import {RateLimitError} from './errors.js';

const DAILY_LIMIT = 3;

export interface RecordParams {
  conversationId: string;
  installId: string;
  clientId: string;
  provider: string;
  initialQuery: string;
  isCustomKey?: boolean;
}

export class RateLimiter {
  private countStmt: ReturnType<Database['prepare']>;
  private insertStmt: ReturnType<Database['prepare']>;

  constructor(private db: Database) {
    this.countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM conversation_history
      WHERE install_id = ?
        AND is_custom_key = 0
        AND date(created_at) = date('now', 'localtime')
    `);

    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO conversation_history
        (id, install_id, client_id, provider, initial_query, is_custom_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  check(installId: string): void {
    const count = this.getTodayCount(installId);
    if (count >= DAILY_LIMIT) {
      logger.warn('Rate limit exceeded', {
        installId,
        count,
        limit: DAILY_LIMIT,
      });
      throw new RateLimitError(count, DAILY_LIMIT);
    }
  }

  record(params: RecordParams): void {
    const {
      conversationId,
      installId,
      clientId,
      provider,
      initialQuery,
      isCustomKey = false,
    } = params;
    this.insertStmt.run(
      conversationId,
      installId,
      clientId,
      provider,
      initialQuery,
      isCustomKey ? 1 : 0,
    );
  }

  private getTodayCount(installId: string): number {
    const row = this.countStmt.get(installId) as {count: number} | null;
    return row?.count ?? 0;
  }
}

export {RateLimitError} from './errors.js';
