/**
 * Klavis MCP tool definitions
 */
import type {ToolDefinition} from '@browseros/tools';
import {z} from 'zod';

import {KlavisAPIManager} from './KlavisAPIManager.js';
import {MCP_SERVERS} from './KlavisMcpServers.js';

/**
 * Get subdomain from server name using config
 */
function getSubdomainFromName(serverName: string): string {
  const config = MCP_SERVERS.find(s => s.name === serverName);
  if (config?.subdomain) {
    return config.subdomain;
  }
  // Fallback: derive from name
  return serverName.toLowerCase().replace(/\s+/g, '');
}

/**
 * Tool 1: Get installed MCP servers
 */
const mcpGetInstances: ToolDefinition = {
  name: 'mcp_get_instances',
  description:
    'Get all installed Klavis MCP servers (Gmail, Google Calendar, Google Sheets, Google Docs, Notion, Slack, GitHub, etc.) with their instance IDs and authentication status. REQUIRED: Must provide userId parameter.',
  annotations: {
    category: 'mcp',
    readOnlyHint: true,
  },
  schema: {
    userId: z.string().describe('Your Klavis user ID for MCP integration'),
  },
  handler: async (request, response, _context) => {
    const {userId} = request.params;

    if (!userId) {
      throw new Error(
        'userId is required for Klavis MCP tools. Please provide your Klavis user ID.',
      );
    }

    const manager = KlavisAPIManager.getInstance(userId);
    const instances = await manager.getInstalledServers();

    if (instances.length === 0) {
      response.appendResponseLine(
        JSON.stringify(
          {
            instances: [],
            message:
              'No MCP servers installed. Install servers via Klavis API.',
          },
          null,
          2,
        ),
      );
      return;
    }

    // Format instances for consumption
    const formattedInstances = instances.map(instance => ({
      id: instance.id,
      name: instance.name,
      authenticated: instance.isAuthenticated,
      authNeeded: instance.authNeeded,
      toolCount: instance.tools?.length || 0,
    }));

    response.appendResponseLine(
      JSON.stringify(
        {
          instances: formattedInstances,
          count: formattedInstances.length,
        },
        null,
        2,
      ),
    );
  },
};

/**
 * Tool 2: List tools for an MCP server
 */
const mcpListTools: ToolDefinition = {
  name: 'mcp_list_tools',
  description:
    'List available tools for a specific Klavis MCP server instance (e.g., list all Gmail tools like send_email, read_email, search_emails). Requires instanceId from mcp_get_instances and userId.',
  annotations: {
    category: 'mcp',
    readOnlyHint: true,
  },
  schema: {
    instanceId: z.string().describe('MCP server instance ID'),
    userId: z.string().optional().describe('Your Klavis user ID for MCP integration'),
  },
  handler: async (request, response, _context) => {
    const {instanceId, userId} = request.params;

    if (!userId) {
      throw new Error(
        'userId is required for Klavis MCP tools. Please provide your Klavis user ID.',
      );
    }

    const manager = KlavisAPIManager.getInstance(userId);

    // Get instance details
    const instances = await manager.getInstalledServers();
    const instance = instances.find(i => i.id === instanceId);

    if (!instance) {
      throw new Error(
        `Instance ${instanceId} not found. Run mcp_get_instances first.`,
      );
    }

    // Get subdomain from config
    const subdomain = getSubdomainFromName(instance.name);
    const tools = await manager.client.listTools(instanceId, subdomain);

    if (!tools || tools.length === 0) {
      response.appendResponseLine(
        JSON.stringify(
          {
            tools: [],
            message: 'No tools available for this server',
          },
          null,
          2,
        ),
      );
      return;
    }

    response.appendResponseLine(
      JSON.stringify(
        {
          tools: tools,
          count: tools.length,
          instanceId: instanceId,
          serverName: instance.name,
        },
        null,
        2,
      ),
    );
  },
};

/**
 * Tool 3: Execute a tool on an MCP server
 */
const mcpCallTool: ToolDefinition = {
  name: 'mcp_call_tool',
  description:
    'Execute a tool on a Klavis MCP server (e.g., send Gmail email, create Google Calendar event, read Notion pages, post to Slack, etc.). Requires instanceId, toolName, toolArgs, and userId.',
  annotations: {
    category: 'mcp',
    readOnlyHint: false,
  },
  schema: {
    instanceId: z.string().describe('MCP server instance ID'),
    toolName: z.string().describe('Name of the tool to execute'),
    toolArgs: z.any().optional().describe('Arguments for the tool (JSON object)'),
    userId: z.string().optional().describe('Your Klavis user ID for MCP integration'),
  },
  handler: async (request, response, _context) => {
    const {instanceId, toolName, toolArgs, userId} = request.params;

    if (!userId) {
      throw new Error(
        'userId is required for Klavis MCP tools. Please provide your Klavis user ID.',
      );
    }

    const manager = KlavisAPIManager.getInstance(userId);

    // Get instance details
    const instances = await manager.getInstalledServers();
    const instance = instances.find(i => i.id === instanceId);

    if (!instance) {
      throw new Error(
        `Instance ${instanceId} not found. Run mcp_get_instances first.`,
      );
    }

    // Get subdomain from config
    const subdomain = getSubdomainFromName(instance.name);

    // Parse toolArgs if it's a string
    let parsedArgs = toolArgs;
    if (typeof toolArgs === 'string') {
      try {
        parsedArgs = JSON.parse(toolArgs);
      } catch {
        // If parsing fails, use as-is
        parsedArgs = toolArgs;
      }
    }

    // Call the tool via Klavis API
    const result = await manager.client.callTool(
      instanceId,
      subdomain,
      toolName,
      parsedArgs || {},
    );

    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }

    // Format successful result
    const output = {
      success: true,
      toolName: toolName,
      result: result.result?.content || result.result,
      instanceId: instanceId,
      serverName: instance.name,
    };

    response.appendResponseLine(JSON.stringify(output, null, 2));
  },
};

/**
 * Export all Klavis tools
 */
export const allKlavisTools: ToolDefinition[] = [
  mcpGetInstances,
  mcpListTools,
  mcpCallTool,
];
