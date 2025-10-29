/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {describe, it, expect, beforeEach} from 'bun:test';

import type {FormattedEvent} from '../utils/EventFormatter.js';

import {BaseAgent, DEFAULT_CONFIG} from './BaseAgent.js';
import type {AgentConfig} from './types.js';

// Concrete test implementation of BaseAgent
class TestAgent extends BaseAgent {
  constructor(config: AgentConfig, agentDefaults?: Partial<AgentConfig>) {
    super('test-agent', config, agentDefaults);
  }

  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    // Minimal implementation for testing
    yield {type: 'test', content: message, metadata: {}} as any;
  }

  async destroy(): Promise<void> {
    this.markDestroyed();
  }
}

describe('BaseAgent-unit-test', () => {
  // Unit Test 1 - Constructor and config merging with defaults
  it('tests that configs merge correctly with defaults', () => {
    const userConfig: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
      maxTurns: 50,
      // systemPrompt not provided, should use default
    };

    const agentDefaults = {
      systemPrompt: 'Agent-specific prompt',
      maxTurns: 75,
      maxThinkingTokens: 5000,
    };

    const agent = new TestAgent(userConfig, agentDefaults);

    // Verify config merging priority: user > agent defaults > base defaults
    expect(agent['config'].apiKey).toBe('test-key');
    expect(agent['config'].cwd).toBe('/test');
    expect(agent['config'].maxTurns).toBe(50); // User overrides agent default
    expect(agent['config'].systemPrompt).toBe('Agent-specific prompt'); // Agent default used
    expect(agent['config'].maxThinkingTokens).toBe(5000); // Agent default used
    expect(agent['config'].permissionMode).toBe(DEFAULT_CONFIG.permissionMode); // Base default used
  });

  // Unit Test 2 - Metadata initialization and state tracking
  it('tests that metadata initializes with correct state', () => {
    const config: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    const agent = new TestAgent(config);
    const metadata = agent.getMetadata();

    // Verify initial metadata state
    expect(metadata.type).toBe('test-agent');
    expect(metadata.state).toBe('idle');
    expect(metadata.turns).toBe(0);
    expect(metadata.toolsExecuted).toBe(0);
    expect(metadata.totalDuration).toBe(0);
    expect(metadata.lastEventTime).toBeGreaterThan(0);
  });

  // Unit Test 3 - Execution state transitions
  it('tests that execution state tracks correctly', () => {
    const config: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    const agent = new TestAgent(config);

    // Initial state
    expect(agent['metadata'].state).toBe('idle');

    // Start execution
    agent['startExecution']();
    expect(agent['metadata'].state).toBe('executing');
    expect(agent['executionStartTime']).toBeGreaterThan(0);

    const startTime = agent['executionStartTime'];

    // Complete execution
    agent['completeExecution']();
    expect(agent['metadata'].state).toBe('idle');
    expect(agent['metadata'].totalDuration).toBeGreaterThanOrEqual(0);
  });

  // Unit Test 4 - Metadata update methods
  it('tests that metadata updates through helper methods', () => {
    const config: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    const agent = new TestAgent(config);
    const initialEventTime = agent['metadata'].lastEventTime;

    // Update event time
    agent['updateEventTime']();
    expect(agent['metadata'].lastEventTime).toBeGreaterThanOrEqual(
      initialEventTime,
    );

    // Increment tools executed
    agent['updateToolsExecuted'](3);
    expect(agent['metadata'].toolsExecuted).toBe(3);

    agent['updateToolsExecuted'](); // Default increment by 1
    expect(agent['metadata'].toolsExecuted).toBe(4);

    // Update turns
    agent['updateTurns'](10);
    expect(agent['metadata'].turns).toBe(10);
  });

  // Unit Test 5 - Error state handling
  it('tests that error state handles correctly', () => {
    const config: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    const agent = new TestAgent(config);

    // Mark error with Error object
    const error = new Error('Test error');
    agent['errorExecution'](error);

    expect(agent['metadata'].state).toBe('error');
    expect(agent['metadata'].error).toBe('Test error');

    // Mark error with string
    const agent2 = new TestAgent(config);
    agent2['errorExecution']('String error');

    expect(agent2['metadata'].state).toBe('error');
    expect(agent2['metadata'].error).toBe('String error');
  });

  // Unit Test 6 - Destroyed state tracking
  it('tests that destroyed state tracks correctly', async () => {
    const config: AgentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    const agent = new TestAgent(config);

    // Initially not destroyed
    expect(agent['isDestroyed']()).toBe(false);

    // Destroy agent
    await agent.destroy();

    // Should be marked as destroyed
    expect(agent['isDestroyed']()).toBe(true);
    expect(agent['metadata'].state).toBe('destroyed');
  });
});
