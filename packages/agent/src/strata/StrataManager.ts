/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {logger} from '@browseros/common';

const KLAVIS_API_BASE = 'https://api.klavis.ai';

interface CreateStrataResponse {
  strataServerUrl: string;
  strataId: string;
  addedServers: string[];
  oauthUrls?: Record<string, string>;
  apiKeyUrls?: Record<string, string>;
}

export class StrataManager {
  private static cache = new Map<string, string>();
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.KLAVIS_API_KEY || '';
  }

  async getOrCreateStrataUrl(userId: string): Promise<string | null> {
    if (!this.apiKey) {
      logger.debug('Klavis API key not configured, skipping Strata');
      return null;
    }

    if (!userId) {
      logger.debug('No userId provided, skipping Strata');
      return null;
    }

    // Check cache first
    const cached = StrataManager.cache.get(userId);
    if (cached) {
      logger.debug('Using cached Strata URL', {userId});
      return cached;
    }

    try {
      const response = await fetch(`${KLAVIS_API_BASE}/mcp-server/strata/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          servers: 'ALL',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to create Strata instance', {
          status: response.status,
          error: errorText,
        });
        return null;
      }

      const data = await response.json() as CreateStrataResponse;
      const strataUrl = data.strataServerUrl;

      // Cache for future requests
      StrataManager.cache.set(userId, strataUrl);

      logger.info('Created Strata instance', {
        userId,
        strataId: data.strataId,
        serverCount: data.addedServers?.length || 0,
      });

      return strataUrl;
    } catch (error) {
      logger.error('Error creating Strata instance', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  static clearCache(userId?: string) {
    if (userId) {
      StrataManager.cache.delete(userId);
    } else {
      StrataManager.cache.clear();
    }
  }
}
