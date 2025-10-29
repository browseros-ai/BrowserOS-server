/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {z} from 'zod';

/**
 * Formatted event structure for WebSocket clients
 */
export class FormattedEvent {
  type:
    | 'init'
    | 'thinking'
    | 'tool_use'
    | 'tool_result'
    | 'response'
    | 'completion'
    | 'error'
    | 'processing';
  content: string;
  metadata?: {
    turnCount?: number;
    isError?: boolean;
    duration?: number;
    deniedTools?: number;
  };

  constructor(
    type: FormattedEvent['type'],
    content: string,
    metadata?: FormattedEvent['metadata'],
  ) {
    this.type = type;
    this.content = content;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      type: this.type,
      content: this.content,
      ...(this.metadata && {metadata: this.metadata}),
    };
  }
}

/**
 * Configuration for agent initialization
 *
 * Contains all parameters needed to create and configure an agent
 */
export const AgentConfigSchema = z.object({
  /**
   * API key for the agent SDK (Anthropic, OpenAI, etc.)
   */
  apiKey: z.string().min(1, 'API key is required'),

  /**
   * Working directory for file operations
   */
  cwd: z.string().min(1, 'Working directory is required'),

  /**
   * Resources directory path (optional)
   */
  resourcesDir: z.string().optional(),

  /**
   * MCP server port (default: 9100)
   */
  mcpServerPort: z.number().positive().optional(),

  /**
   * Maximum conversation turns before stopping
   * Default: 100
   */
  maxTurns: z.number().positive().optional(),

  /**
   * Maximum thinking tokens (limits Claude's "thinking" time)
   * Default: 10000
   */
  maxThinkingTokens: z.number().positive().optional(),

  /**
   * System prompt to guide agent behavior
   * Optional - agents may have default prompts
   */
  systemPrompt: z.string().optional(),

  /**
   * MCP servers configuration (handled internally by agents)
   * Optional - agents create their own MCP servers
   */
  mcpServers: z.record(z.string(), z.any()).optional(),

  /**
   * Permission mode for tool execution
   * - 'bypassPermissions': Auto-approve all tools (current behavior)
   * - 'requireApproval': Ask user before each tool
   */
  permissionMode: z.enum(['bypassPermissions', 'requireApproval']).optional(),

  /**
   * Agent-specific custom options
   * Allows custom agents to accept additional config
   */
  customOptions: z.record(z.string(), z.unknown()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Runtime metadata about agent execution state
 */
export const AgentMetadataSchema = z.object({
  /**
   * Agent type identifier (e.g., 'claude-sdk')
   */
  type: z.string(),

  /**
   * Current turn count
   */
  turns: z.number().nonnegative(),

  /**
   * Total execution time in milliseconds (across all execute() calls)
   */
  totalDuration: z.number().nonnegative(),

  /**
   * Timestamp of last event emitted
   */
  lastEventTime: z.number().positive(),

  /**
   * Number of tools executed
   */
  toolsExecuted: z.number().nonnegative(),

  /**
   * Current agent state
   */
  state: z.enum(['idle', 'executing', 'error', 'destroyed']),

  /**
   * Error message if state is 'error'
   */
  error: z.string().optional(),

  /**
   * Agent-specific custom metadata
   */
  custom: z.record(z.string(), z.unknown()).optional(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;
