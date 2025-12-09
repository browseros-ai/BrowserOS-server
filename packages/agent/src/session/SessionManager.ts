/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from '@browseros/common';

import {GeminiAgent} from '../agent/GeminiAgent.js';
import type {AgentConfig} from '../agent/types.js';

export class SessionManager {
  private sessions = new Map<string, GeminiAgent>();

  async getOrCreate(config: AgentConfig): Promise<GeminiAgent> {
    const existing = this.sessions.get(config.conversationId);

    if (existing) {
      logger.info('Reusing existing session', {
        conversationId: config.conversationId,
        historyLength: existing.getHistory().length,
      });
      return existing;
    }

    const agent = await GeminiAgent.create(config);
    this.sessions.set(config.conversationId, agent);

    logger.info('Session added to manager', {
      conversationId: config.conversationId,
      totalSessions: this.sessions.size,
    });

    return agent;
  }

  delete(conversationId: string): boolean {
    const deleted = this.sessions.delete(conversationId);
    if (deleted) {
      logger.info('Session deleted', {
        conversationId,
        remainingSessions: this.sessions.size,
      });
    }
    return deleted;
  }

  count(): number {
    return this.sessions.size;
  }

  has(conversationId: string): boolean {
    return this.sessions.has(conversationId);
  }
}
