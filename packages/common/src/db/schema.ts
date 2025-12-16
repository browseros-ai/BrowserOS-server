/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type {Database} from 'bun:sqlite';

const CONVERSATION_HISTORY_TABLE = `
CREATE TABLE IF NOT EXISTS conversation_history (
  id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  initial_query TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_custom_key INTEGER NOT NULL DEFAULT 0
)`;

const CONVERSATION_HISTORY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_install_date
ON conversation_history(install_id, created_at)`;

export function initSchema(db: Database): void {
  db.exec(CONVERSATION_HISTORY_TABLE);
  db.exec(CONVERSATION_HISTORY_INDEX);
}
