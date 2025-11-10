/**
 * Minimal Klavis API client for MCP server operations
 * No external dependencies - just fetch API and TypeScript
 */

// Simple type definitions for API responses
export interface UserInstance {
  id: string  // Instance ID
  name: string  // Server name (e.g., "Gmail", "GitHub")
  description: string | null  // Server description
  tools: Array<{ name: string; description: string }> | null  // Available tools
  authNeeded: boolean  // Whether auth is required
  isAuthenticated: boolean  // Whether currently authenticated
  serverUrl?: string  // Server URL for this instance
}

export interface CreateServerResponse {
  serverUrl: string  // Full URL for connecting to the MCP server
  instanceId: string  // Unique identifier for this server instance
  oauthUrl?: string | null  // OAuth URL if authentication needed
}

export interface ToolCallResult {
  success: boolean  // Whether the call was successful
  result?: {
    content: any[]  // Tool execution results
    isError?: boolean  // Whether the result is an error
  }
  error?: string  // Error message if failed
}

export class KlavisAPIClient {
  private readonly baseUrl = 'https://api.klavis.ai'
  
  constructor(private apiKey: string) {
    // Allow empty API key but operations will fail with clear error
  }

  /**
   * Make HTTP request to Klavis API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    query?: Record<string, string>
  ): Promise<T> {
    // Check for API key
    if (!this.apiKey) {
      throw new Error('Klavis API key not configured. Please add KLAVIS_API_KEY to your .env file.')
    }
    
    let url = `${this.baseUrl}${path}`
    
    // Add query parameters if provided
    if (query) {
      const params = new URLSearchParams(query)
      url += '?' + params.toString()
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Klavis API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Get all MCP server instances for a user
   * GET /user/instances
   */
  async getUserInstances(userId: string, platformName: string): Promise<UserInstance[]> {
    const data = await this.request<{ instances: UserInstance[] }>(
      'GET',
      '/user/instances',
      undefined,
      {
        user_id: userId,
        platform_name: platformName
      }
    )
    
    // Return instances directly without constructing serverUrl
    return data.instances || []
  }

  /**
   * Create a new MCP server instance
   * POST /mcp-server/instance/create
   */
  async createServerInstance(params: {
    serverName: string
    userId: string
    platformName: string
  }): Promise<CreateServerResponse> {
    return this.request<CreateServerResponse>(
      'POST',
      '/mcp-server/instance/create',
      {
        serverName: params.serverName,
        userId: params.userId,
        platformName: params.platformName,
        connectionType: 'StreamableHttp'  // Always use StreamableHttp
      }
    )
  }

  /**
   * List available tools for an MCP server
   * POST /mcp-server/list-tools
   */
  async listTools(instanceId: string, serverSubdomain: string): Promise<any[]> {
    // Construct serverUrl from instanceId and serverSubdomain
    const serverUrl = `https://${serverSubdomain}-mcp-server.klavis.ai/mcp/?instance_id=${instanceId}`
    
    const data = await this.request<{
      success: boolean
      tools?: any[]
      error?: string
    }>(
      'POST',
      '/mcp-server/list-tools',
      {
        serverUrl,
        format: 'openai',  // Use native format for flexibility
        connectionType: 'StreamableHttp'
      }
    )

    if (!data.success) {
      throw new Error(`Failed to list tools: ${data.error || 'Unknown error'}`)
    }

    return data.tools || []
  }

  /**
   * Call a tool on an MCP server
   * POST /mcp-server/call-tool
   */
  async callTool(
    instanceId: string,
    serverSubdomain: string,
    toolName: string,
    toolArgs: any
  ): Promise<ToolCallResult> {
    // Construct serverUrl from instanceId and serverSubdomain
    const serverUrl = `https://${serverSubdomain}-mcp-server.klavis.ai/mcp/?instance_id=${instanceId}`
    
    try {
      const response = await this.request<ToolCallResult>(
        'POST',
        '/mcp-server/call-tool',
        {
          serverUrl,
          toolName,
          toolArgs: toolArgs || {},
          format: 'openai',
          connectionType: 'StreamableHttp'
        }
      )

      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete a server instance
   * DELETE /mcp-server/instance/delete/{instance_id}
   */
  async deleteServerInstance(instanceId: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(
      'DELETE',
      `/mcp-server/instance/delete/${instanceId}`,
      undefined
    )
  }

  /**
   * Get all available MCP servers
   * GET /mcp-server/servers
   */
  async getAllServers(): Promise<Array<{
    id: string
    name: string
    description: string
    tools: Array<{ name: string; description: string }>
    authNeeded: boolean
  }>> {
    const data = await this.request<{ servers: any[] }>(
      'GET',
      '/mcp-server/servers',
      undefined
    )
    
    return data.servers || []
  }

  /**
   * Get authentication metadata for a server instance
   * GET /mcp-server/instance/get-auth/{instance_id}
   */
  async getAuthMetadata(instanceId: string): Promise<{
    success: boolean
    authData?: any
    error?: string
  }> {
    try {
      return await this.request<{
        success: boolean
        authData?: any
        error?: string
      }>(
        'GET',
        `/mcp-server/instance/get-auth/${instanceId}`,
        undefined
      )
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auth metadata'
      }
    }
  }

  /**
   * Get instance status including authentication state
   * GET /mcp-server/instance/{instanceId}
   */
  async getInstanceStatus(instanceId: string): Promise<{
    instanceId: string | null
    authNeeded: boolean
    isAuthenticated: boolean
    serverName: string
    platform: string
    externalUserId: string
    oauthUrl: string | null
  }> {
    return this.request<{
      instanceId: string | null
      authNeeded: boolean
      isAuthenticated: boolean
      serverName: string
      platform: string
      externalUserId: string
      oauthUrl: string | null
    }>(
      'GET',
      `/mcp-server/instance/${instanceId}`,
      undefined
    )
  }
}
