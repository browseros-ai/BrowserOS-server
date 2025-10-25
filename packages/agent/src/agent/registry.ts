/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { AgentFactory } from './AgentFactory.js'
import { CodexSDKAgent } from './CodexSDKAgent.js'
import { ClaudeSDKAgent } from './ClaudeSDKAgent.js'

/**
 * Register all available agents
 *
 * This should be called once at application startup to register
 * all agent types with the factory.
 */
export function registerAgents(): void {
  AgentFactory.register(
    'codex-sdk',
    CodexSDKAgent,
    'Codex SDK agent for OpenAI Codex integration'
  )

  AgentFactory.register(
    'claude-sdk',
    ClaudeSDKAgent,
    'Claude SDK agent for Anthropic Claude integration'
  )
}
