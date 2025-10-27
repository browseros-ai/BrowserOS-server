/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {logger} from '@browseros/common';
import type {AgentConfig, AgentMetadata, FormattedEvent} from './types.js';

/**
 * Generic default system prompt for agents
 *
 * Minimal prompt - agents should override with their own specific prompts
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a browser automation agent.`;

/**
 * Generic default configuration values
 *
 * Agents can override these with their own defaults
 */
export const DEFAULT_CONFIG = {
  maxTurns: 100,
  maxThinkingTokens: 10000,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  mcpServers: {},
  permissionMode: 'bypassPermissions' as const,
};

/**
 * BaseAgent - Abstract base class for all agent implementations
 *
 * Provides:
 * - Common configuration handling with defaults
 * - Metadata management
 * - Logging helpers
 * - Abstract methods that concrete agents must implement
 *
 * Subclasses can override defaults by passing them to the constructor.
 *
 * Usage:
 *   export class MyAgent extends BaseAgent {
 *     constructor(config: AgentConfig) {
 *       super('my-agent', config, {
 *         systemPrompt: 'My custom prompt',
 *         mcpServers: { ... },
 *         maxTurns: 50
 *       })
 *     }
 *     async *execute(message: string): AsyncGenerator<FormattedEvent> {
 *       // Implementation
 *     }
 *     async destroy(): Promise<void> {
 *       // Cleanup
 *     }
 *   }
 */
export abstract class BaseAgent {
  protected config: Required<AgentConfig>;
  protected metadata: AgentMetadata;
  protected executionStartTime: number = 0;
  protected initialized: boolean = false;

  constructor(
    agentType: string,
    config: AgentConfig,
    agentDefaults?: Partial<AgentConfig>,
  ) {
    // Merge config with agent-specific defaults, then with base defaults
    this.config = {
      apiKey: config.apiKey,
      cwd: config.cwd,
      mcpServerPort: config.mcpServerPort ?? agentDefaults?.mcpServerPort,
      maxTurns:
        config.maxTurns ?? agentDefaults?.maxTurns ?? DEFAULT_CONFIG.maxTurns,
      maxThinkingTokens:
        config.maxThinkingTokens ??
        agentDefaults?.maxThinkingTokens ??
        DEFAULT_CONFIG.maxThinkingTokens,
      systemPrompt:
        config.systemPrompt ??
        agentDefaults?.systemPrompt ??
        DEFAULT_CONFIG.systemPrompt,
      mcpServers:
        config.mcpServers ??
        agentDefaults?.mcpServers ??
        DEFAULT_CONFIG.mcpServers,
      permissionMode:
        config.permissionMode ??
        agentDefaults?.permissionMode ??
        DEFAULT_CONFIG.permissionMode,
      customOptions: config.customOptions ?? agentDefaults?.customOptions ?? {},
    } as Required<AgentConfig>;

    // Initialize metadata
    this.metadata = {
      type: agentType,
      turns: 0,
      totalDuration: 0,
      lastEventTime: Date.now(),
      toolsExecuted: 0,
      state: 'idle',
    };

    logger.debug(`🤖 ${agentType} agent created`, {
      agentType,
      cwd: this.config.cwd,
      maxTurns: this.config.maxTurns,
      maxThinkingTokens: this.config.maxThinkingTokens,
      usingDefaultMcp: !config.mcpServers,
      usingDefaultPrompt: !config.systemPrompt,
    });
  }

  /**
   * Async initialization for agents that need it
   * Subclasses can override for async setup (e.g., fetching config)
   */
  async init(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Execute a task and stream events
   * Must be implemented by concrete agent classes
   */
  // FIXME: make it handle init if not initialized
  abstract execute(message: string): AsyncGenerator<FormattedEvent>;

  /**
   * Cleanup agent resources
   * Must be implemented by concrete agent classes
   */
  abstract destroy(): Promise<void>;

  /**
   * Get current agent metadata
   */
  getMetadata(): AgentMetadata {
    return {...this.metadata};
  }

  /**
   * Helper: Start execution tracking
   */
  protected startExecution(): void {
    this.metadata.state = 'executing';
    this.executionStartTime = Date.now();
  }

  /**
   * Helper: Complete execution tracking
   */
  protected completeExecution(): void {
    this.metadata.state = 'idle';
    this.metadata.totalDuration += Date.now() - this.executionStartTime;
  }

  /**
   * Helper: Mark execution error
   */
  protected errorExecution(error: Error | string): void {
    this.metadata.state = 'error';
    this.metadata.error = error instanceof Error ? error.message : error;
  }

  /**
   * Helper: Update last event time
   */
  protected updateEventTime(): void {
    this.metadata.lastEventTime = Date.now();
  }

  /**
   * Helper: Increment tool execution count
   */
  protected updateToolsExecuted(count: number = 1): void {
    this.metadata.toolsExecuted += count;
  }

  /**
   * Helper: Update turn count
   */
  protected updateTurns(turns: number): void {
    this.metadata.turns = turns;
  }

  /**
   * Helper: Check if agent is destroyed
   */
  protected isDestroyed(): boolean {
    return this.metadata.state === 'destroyed';
  }

  /**
   * Helper: Mark agent as destroyed
   */
  protected markDestroyed(): void {
    this.metadata.state = 'destroyed';
  }

  /**
   * Helper: Ensure agent is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Agent not initialized. Call init() before execute()');
    }
  }
}
