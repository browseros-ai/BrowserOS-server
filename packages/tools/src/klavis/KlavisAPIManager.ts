/**
 * Manages MCP servers - per-user instance
 * Server-side version with session-based user IDs
 */

import {
  KlavisAPIClient,
  type CreateServerResponse,
  type UserInstance,
} from './KlavisAPIClient.js';

const PLATFORM_NAME = 'Nxtscape';

/**
 * Manages MCP servers - per-user instance
 *
 * Key differences from Chrome extension version:
 * - userId passed in constructor (from WebSocket session)
 * - No Chrome storage dependency
 * - No OAuth handling (assume pre-authenticated for now)
 */
export class KlavisAPIManager {
  private static instances: Map<string, KlavisAPIManager> = new Map();
  public readonly client: KlavisAPIClient;
  private userId: string;

  private constructor(userId: string, apiKey: string) {
    this.userId = userId;
    this.client = new KlavisAPIClient(apiKey);
  }

  /**
   * Get or create instance for a specific user
   *
   * @param userId - Klavis user ID (from WebSocket session)
   * @returns KlavisAPIManager instance for this user
   * @throws Error if KLAVIS_API_KEY is not configured
   */
  static getInstance(userId?: string): KlavisAPIManager {
    const apiKey = process.env.KLAVIS_API_KEY || '';
    if (!apiKey) {
      throw new Error(
        'KLAVIS_API_KEY not configured. Set KLAVIS_API_KEY environment variable.',
      );
    }

    // userId validation will happen when making API calls
    const effectiveUserId = userId;
    console.log('effectiveUserId', effectiveUserId);
    if (!effectiveUserId) {
      throw new Error(
        'userId is required for Klavis MCP tools. Please provide userId in tool parameters.',
      );
    }

    // Return cached instance if exists
    if (KlavisAPIManager.instances.has(effectiveUserId)) {
      return KlavisAPIManager.instances.get(effectiveUserId)!;
    }

    // Create new instance
    const instance = new KlavisAPIManager(effectiveUserId, apiKey);
    KlavisAPIManager.instances.set(effectiveUserId, instance);

    return instance;
  }

  /**
   * Get user ID for this manager
   */
  async getUserId(): Promise<string> {
    return this.userId;
  }

  /**
   * Install a new MCP server (not implemented yet - requires OAuth)
   */
  async installServer(
    serverName: string,
  ): Promise<CreateServerResponse & {authSuccess?: boolean}> {
    const userId = await this.getUserId();

    const server = await this.client.createServerInstance({
      serverName,
      userId,
      platformName: PLATFORM_NAME,
    });

    // OAuth handling would go here
    // For now, just return the response
    return server;
  }

  /**
   * Get all installed MCP servers for the current user
   */
  async getInstalledServers(): Promise<UserInstance[]> {
    const userId = await this.getUserId();
    if (!userId) {
      throw new Error(
        'userId is required for Klavis MCP tools. Please provide userId in tool parameters.',
      );
    }
    return this.client.getUserInstances(userId, PLATFORM_NAME);
  }

  /**
   * Delete an MCP server instance
   */
  async deleteServer(instanceId: string): Promise<boolean> {
    const result = await this.client.deleteServerInstance(instanceId);
    return result.success;
  }

  /**
   * Get all available MCP servers (not installed, just available)
   */
  async getAvailableServers() {
    return this.client.getAllServers();
  }

  /**
   * Check if a server is installed and authenticated
   */
  async isServerReady(
    serverName: string,
  ): Promise<{
    installed: boolean;
    authenticated: boolean;
    instanceId?: string;
  }> {
    const servers = await this.getInstalledServers();
    const server = servers.find(
      s => s.name.toLowerCase() === serverName.toLowerCase(),
    );

    if (!server) {
      return {installed: false, authenticated: false};
    }

    return {
      installed: true,
      authenticated: server.isAuthenticated,
      instanceId: server.id,
    };
  }
}
