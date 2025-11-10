import { z } from 'zod'

// MCP server configuration schema
export const MCPServerConfigSchema = z.object({
  id: z.string(),  // Server identifier
  name: z.string(),  // Display name
  subdomain: z.string(),  // Server subdomain for URL construction
  iconPath: z.string(),  // Path to icon in assets
})

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>

// Available MCP servers - names must match Klavis API exactly
// Currently limited to core Google Workspace and Notion
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    subdomain: 'gcalendar',
    iconPath: 'assets/mcp_servers/google-calendar.svg',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    subdomain: 'gmail',
    iconPath: 'assets/mcp_servers/gmail.svg',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    subdomain: 'gsheets',
    iconPath: 'assets/mcp_servers/google-sheets.svg',
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    subdomain: 'gdocs',
    iconPath: 'assets/mcp_servers/google-docs.svg',
  },
  {
    id: 'notion',
    name: 'Notion',
    subdomain: 'notion',
    iconPath: 'assets/mcp_servers/notion.svg',
  },
]