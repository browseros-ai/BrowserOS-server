/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const KLAVIS_API_BASE = 'https://api.klavis.ai';

export interface StrataCreateResponse {
  strataServerUrl: string;
  strataId: string;
  addedServers: string[];
  oauthUrls?: Record<string, string>;
}

export class KlavisClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.KLAVIS_API_KEY;
    if (!key) {
      throw new Error('KLAVIS_API_KEY not configured');
    }
    this.apiKey = key;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${KLAVIS_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Klavis API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Create Strata instance with specified servers
   * Returns strataServerUrl for MCP connection and oauthUrls for authentication
   */
  async createStrata(
    userId: string,
    servers: string[],
  ): Promise<StrataCreateResponse> {
    return this.request<StrataCreateResponse>(
      'POST',
      '/mcp-server/strata/create',
      {userId, servers},
    );
  }

  /**
   * Get user integrations with authentication status
   */
  async getUserIntegrations(
    userId: string,
  ): Promise<Array<{name: string; isAuthenticated: boolean}>> {
    const data = await this.request<{
      integrations: Array<{name: string; isAuthenticated: boolean}>;
    }>('GET', `/user/${userId}/integrations`);
    return data.integrations || [];
  }
}
