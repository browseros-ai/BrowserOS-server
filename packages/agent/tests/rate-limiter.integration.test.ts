/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Integration tests for RateLimiter
 * Uses in-memory SQLite to test actual database behavior
 */
import {describe, it, expect, beforeEach} from 'bun:test';
import {Database} from 'bun:sqlite';

import {RateLimiter, RateLimitError} from '../src/rate-limiter/index.js';

const DAILY_RATE_LIMIT_TEST = 3;

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limiter (
      id TEXT PRIMARY KEY,
      browseros_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

describe('RateLimiter', () => {
  let db: Database;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    db = createTestDb();
    rateLimiter = new RateLimiter(db, DAILY_RATE_LIMIT_TEST);
  });

  describe('check()', () => {
    it('allows first 3 conversations (check before record)', () => {
      const browserosId = 'test-browseros-id';

      // Simulates real flow: check() then record() for each conversation
      for (let i = 1; i <= 3; i++) {
        expect(() => rateLimiter.check(browserosId)).not.toThrow();
        rateLimiter.record({
          conversationId: `conv-${i}`,
          browserosId,
          provider: 'browseros',
        });
      }
    });

    it('blocks 4th conversation with RateLimitError', () => {
      const browserosId = 'test-browseros-id';

      // Use up all 3 slots
      for (let i = 1; i <= 3; i++) {
        rateLimiter.check(browserosId);
        rateLimiter.record({
          conversationId: `conv-${i}`,
          browserosId,
          provider: 'browseros',
        });
      }

      // 4th should be blocked
      expect(() => rateLimiter.check(browserosId)).toThrow(RateLimitError);

      try {
        rateLimiter.check(browserosId);
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rateLimitError = error as RateLimitError;
        expect(rateLimitError.used).toBe(3);
        expect(rateLimitError.limit).toBe(3);
        expect(rateLimitError.statusCode).toBe(429);
      }
    });
  });

  describe('record() with duplicate conversation IDs', () => {
    it('ignores duplicate conversation IDs (same conversation counted once)', () => {
      const browserosId = 'test-browseros-id';
      const sameConversationId = 'duplicate-conv-id';

      // Record the same conversation 5 times
      for (let i = 0; i < 5; i++) {
        rateLimiter.record({
          conversationId: sameConversationId,
          browserosId,
          provider: 'browseros',
        });
      }

      // Should still pass - only counts as 1 conversation
      expect(() => rateLimiter.check(browserosId)).not.toThrow();

      // Add 2 more unique conversations (total 3)
      rateLimiter.record({
        conversationId: 'unique-conv-1',
        browserosId,
        provider: 'browseros',
      });
      rateLimiter.record({
        conversationId: 'unique-conv-2',
        browserosId,
        provider: 'browseros',
      });

      // Now at limit (3 unique conversations)
      expect(() => rateLimiter.check(browserosId)).toThrow(RateLimitError);
    });
  });

  describe('separate limits per browserosId', () => {
    it('tracks limits independently for different users', () => {
      const user1 = 'browseros-user-1';
      const user2 = 'browseros-user-2';

      // User 1 uses all 3 conversations
      for (let i = 1; i <= 3; i++) {
        rateLimiter.record({
          conversationId: `user1-conv-${i}`,
          browserosId: user1,
          provider: 'browseros',
        });
      }

      // User 1 is blocked
      expect(() => rateLimiter.check(user1)).toThrow(RateLimitError);

      // User 2 should still have full quota
      expect(() => rateLimiter.check(user2)).not.toThrow();

      // User 2 can use their quota
      rateLimiter.record({
        conversationId: 'user2-conv-1',
        browserosId: user2,
        provider: 'browseros',
      });
      expect(() => rateLimiter.check(user2)).not.toThrow();
    });
  });
});
