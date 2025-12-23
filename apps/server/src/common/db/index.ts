/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { Database } from 'bun:sqlite'

import { initSchema } from './schema.js'

let db: Database | null = null

export function initializeDb(dbPath: string): Database {
  if (!db) {
    db = new Database(dbPath)
    db.exec('PRAGMA journal_mode = WAL')
    initSchema(db)
  }
  return db
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
