/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const KLAVIS_PROXY_URL = 'https://llm.browseros.com/klavis';

export interface StrataCreateResponse {
  strataServerUrl: string;
  strataId: string;
  addedServers: string[];
  oauthUrls?: Record<string, string>;
}

export class KlavisClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || KLAVIS_PROXY_URL;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Klavis error: ${response.status} ${response.statusText} - ${errorText}`,
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

  /**
   * Remove a server from a Strata instance
   * Flow: createStrata(server) to get strataId → DELETE /strata/{strataId}/servers?servers=X
   */
  async removeServer(userId: string, serverName: string): Promise<void> {
    // createStrata to get strataId (passing same server ensures it exists)
    const strata = await this.createStrata(userId, [serverName]);
    await this.request(
      'DELETE',
      `/mcp-server/strata/${strata.strataId}/servers?servers=${encodeURIComponent(serverName)}`,
    );
  }
}
