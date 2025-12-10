/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Server configuration schema and types
 */
import {z} from 'zod';

const portSchema = z.number().int().min(1).max(65535);

export const ServerConfigSchema = z.object({
  // Ports
  cdpPort: portSchema.nullable(),
  httpMcpPort: portSchema,
  agentPort: portSchema,
  extensionPort: portSchema,

  // Directories
  resourcesDir: z.string(),
  executionDir: z.string(),

  // MCP settings
  mcpAllowRemote: z.boolean(),

  // Instance metadata (for analytics)
  instanceClientId: z.string().optional(),
  instanceInstallId: z.string().optional(),
  instanceBrowserosVersion: z.string().optional(),
  instanceChromiumVersion: z.string().optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Partial config from TOML/ENV sources before merging and validation
 */
export interface PartialServerConfig {
  cdpPort?: number;
  httpMcpPort?: number;
  agentPort?: number;
  extensionPort?: number;
  resourcesDir?: string;
  executionDir?: string;
  mcpAllowRemote?: boolean;
  instanceClientId?: string;
  instanceInstallId?: string;
  instanceBrowserosVersion?: string;
  instanceChromiumVersion?: string;
}
