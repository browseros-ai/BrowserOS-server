/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Database } from 'bun:sqlite'

// id is the conversation_id - using it as PK ensures same conversation is only counted once
const RATE_LIMITER_TABLE = `
CREATE TABLE IF NOT EXISTS rate_limiter (
  id TEXT PRIMARY KEY,
  browseros_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const IDENTITY_TABLE = `
CREATE TABLE IF NOT EXISTS identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  browseros_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

export function initSchema(db: Database): void {
  db.exec(RATE_LIMITER_TABLE)
  db.exec(IDENTITY_TABLE)
}
