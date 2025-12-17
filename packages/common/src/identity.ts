/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type {Database} from 'bun:sqlite';

export interface IdentityConfig {
  installId?: string;
  db: Database;
}

class IdentityService {
  private browserOSId: string | null = null; // Unique identifier for the BrowserOS instance

  initialize(config: IdentityConfig): void {
    const {installId, db} = config;

    // Priority: DB > config > generate new
    this.browserOSId =
      this.loadFromDb(db) || installId || this.generateAndSave(db);
  }

  getBrowserOSId(): string {
    if (!this.browserOSId) {
      throw new Error(
        'IdentityService not initialized. Call initialize() first.',
      );
    }
    return this.browserOSId;
  }

  isInitialized(): boolean {
    return this.browserOSId !== null;
  }

  private loadFromDb(db: Database): string | null {
    const stmt = db.prepare('SELECT browseros_id FROM identity WHERE id = 1');
    const row = stmt.get() as {browseros_id: string} | null;
    return row?.browseros_id ?? null;
  }

  private generateAndSave(db: Database): string {
    const browserosId = crypto.randomUUID();
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO identity (id, browseros_id) VALUES (1, ?)',
    );
    stmt.run(browserosId);
    return browserosId;
  }
}

export const identity = new IdentityService();
