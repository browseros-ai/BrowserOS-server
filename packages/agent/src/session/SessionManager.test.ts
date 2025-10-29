/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {describe, it, expect, beforeEach, afterEach} from 'bun:test';

import type {FormattedEvent} from '../utils/EventFormatter.js';

import {BaseAgent} from '../agent/BaseAgent.js';
import type {AgentConfig} from '../agent/types.js';
import {AgentFactory} from '../agent/AgentFactory.js';
import {SessionManager} from './SessionManager.js';

// Test agent implementation
class TestAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('test-agent', config);
  }

  async *execute(message: string): AsyncGenerator<FormattedEvent> {
    yield {type: 'test', content: message, metadata: {}} as any;
  }

  async destroy(): Promise<void> {
    this.markDestroyed();
  }
}

describe('SessionManager-unit-test', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Register test agent
    AgentFactory.register('test-agent', TestAgent as any, 'Test agent');

    // Create fresh instance for each test
    sessionManager = new SessionManager({
      maxSessions: 5,
      idleTimeoutMs: 60000,
    });
  });

  afterEach(() => {
    // Clean up agent registry
    AgentFactory.clear();
  });

  // Unit Test 1 - Creation and initialization
  it('tests that SessionManager creates with correct initial state', () => {
    expect(sessionManager).toBeDefined();

    // Verify private fields are initialized
    expect(sessionManager['sessions']).toBeInstanceOf(Map);
    expect(sessionManager['agents']).toBeInstanceOf(Map);
    expect(sessionManager['sessions'].size).toBe(0);
    expect(sessionManager['agents'].size).toBe(0);

    // Verify config is stored
    expect(sessionManager['config'].maxSessions).toBe(5);
    expect(sessionManager['config'].idleTimeoutMs).toBe(60000);
  });

  // Unit Test 2 - Session creation and state management
  it('tests that session creates and updates state correctly', () => {
    const agentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    // Check initial state
    expect(sessionManager['sessions'].size).toBe(0);
    expect(sessionManager.isAtCapacity()).toBe(false);

    // Create session
    const session = sessionManager.createSession(
      {id: crypto.randomUUID(), agentType: 'test-agent'},
      agentConfig,
    );

    // Verify state changes
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.messageCount).toBe(0);
    expect(sessionManager['sessions'].size).toBe(1);
    expect(sessionManager['agents'].size).toBe(1);

    // Verify capacity calculation
    const capacity = sessionManager.getCapacity();
    expect(capacity.active).toBe(1);
    expect(capacity.available).toBe(4);
  });

  // Unit Test 3 - Session state transitions
  it('tests that session state transitions handle correctly', () => {
    const sessionId = crypto.randomUUID();
    const agentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    // Create session
    sessionManager.createSession(
      {id: sessionId, agentType: 'test-agent'},
      agentConfig,
    );
    const session = sessionManager['sessions'].get(sessionId);

    // Initial state should be IDLE
    expect(session?.state).toBe('idle');

    // Mark as processing
    const marked = sessionManager.markProcessing(sessionId);
    expect(marked).toBe(true);
    expect(session?.state).toBe('processing');
    expect(session?.messageCount).toBe(1);

    // Try to mark as processing again (should fail)
    const markedAgain = sessionManager.markProcessing(sessionId);
    expect(markedAgain).toBe(false);
    expect(session?.messageCount).toBe(1); // Should not increment

    // Mark as idle
    sessionManager.markIdle(sessionId);
    expect(session?.state).toBe('idle');
    expect(session?.lastActivity).toBeGreaterThan(0);
  });

  // Unit Test 4 - Idle session detection
  it('tests that idle sessions identify correctly', async () => {
    const sessionId = crypto.randomUUID();
    const agentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    // Create session with short idle timeout
    const shortTimeoutManager = new SessionManager({
      maxSessions: 5,
      idleTimeoutMs: 100, // 100ms
    });

    shortTimeoutManager.createSession(
      {id: sessionId, agentType: 'test-agent'},
      agentConfig,
    );

    // Mark as idle
    shortTimeoutManager.markIdle(sessionId);

    // Initially should not be idle
    let idleSessions = shortTimeoutManager.findIdleSessions();
    expect(idleSessions).toHaveLength(0);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Now should be detected as idle
    idleSessions = shortTimeoutManager.findIdleSessions();
    expect(idleSessions).toHaveLength(1);
    expect(idleSessions[0]).toBe(sessionId);

    // Cleanup
    await shortTimeoutManager.deleteSession(sessionId);
  });

  // Unit Test 5 - Capacity management
  it('tests that capacity limits enforce correctly', () => {
    const smallManager = new SessionManager({
      maxSessions: 2,
      idleTimeoutMs: 60000,
    });

    const agentConfig = {
      apiKey: 'test-key',
      cwd: '/test',
    };

    // Create first session
    smallManager.createSession({agentType: 'test-agent'}, agentConfig);
    expect(smallManager.isAtCapacity()).toBe(false);

    // Create second session
    smallManager.createSession({agentType: 'test-agent'}, agentConfig);
    expect(smallManager.isAtCapacity()).toBe(true);

    // Try to create third session (should throw)
    expect(() => {
      smallManager.createSession({agentType: 'test-agent'}, agentConfig);
    }).toThrow('Server at capacity');
  });
});
