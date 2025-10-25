/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { AgentConfig } from './types.js'
import type { ControllerBridge } from '@browseros/controller-server'
import type { BaseAgent } from './BaseAgent.js'

/**
 * Agent constructor signature
 * All agents must extend BaseAgent
 */
export type AgentConstructor = new (
  config: AgentConfig,
  controllerBridge: ControllerBridge
) => BaseAgent

/**
 * Agent registration entry
 */
interface AgentRegistration {
  name: string
  constructor: AgentConstructor
  description?: string
}

/**
 * Agent Factory with Registry Pattern
 *
 * Allows dynamic agent registration and creation without hardcoded types.
 * New agents can be registered at runtime.
 *
 * @example
 * ```typescript
 * // Register agents
 * AgentFactory.register('codex-sdk', CodexSDKAgent, 'Codex SDK agent')
 * AgentFactory.register('claude-sdk', ClaudeSDKAgent, 'Claude SDK agent')
 *
 * // Create agent dynamically
 * const agent = AgentFactory.create('codex-sdk', config, bridge)
 * ```
 */
export class AgentFactory {
  private static registry = new Map<string, AgentRegistration>()

  /**
   * Register an agent type
   *
   * @param type - Agent type identifier (e.g., 'codex-sdk', 'claude-sdk')
   * @param constructor - Agent class constructor
   * @param description - Optional description
   */
  static register(
    type: string,
    constructor: AgentConstructor,
    description?: string
  ): void {
    if (this.registry.has(type)) {
      throw new Error(`Agent type '${type}' is already registered`)
    }

    this.registry.set(type, {
      name: type,
      constructor,
      description
    })
  }

  /**
   * Create an agent instance
   *
   * @param type - Agent type identifier
   * @param config - Agent configuration
   * @param controllerBridge - Shared controller bridge
   * @returns BaseAgent instance
   * @throws Error if agent type is not registered
   */
  static create(
    type: string,
    config: AgentConfig,
    controllerBridge: ControllerBridge
  ): BaseAgent {
    const registration = this.registry.get(type)

    if (!registration) {
      const availableTypes = Array.from(this.registry.keys()).join(', ')
      throw new Error(
        `Agent type '${type}' is not registered. Available types: ${availableTypes}`
      )
    }

    return new registration.constructor(config, controllerBridge)
  }

  /**
   * Check if an agent type is registered
   *
   * @param type - Agent type identifier
   * @returns true if registered
   */
  static has(type: string): boolean {
    return this.registry.has(type)
  }

  /**
   * Get all registered agent types
   *
   * @returns Array of registered agent type identifiers
   */
  static getAvailableTypes(): string[] {
    return Array.from(this.registry.keys())
  }

  /**
   * Get registration info for an agent type
   *
   * @param type - Agent type identifier
   * @returns Registration info or undefined
   */
  static getRegistration(type: string): AgentRegistration | undefined {
    return this.registry.get(type)
  }

  /**
   * Unregister an agent type (useful for testing)
   *
   * @param type - Agent type identifier
   * @returns true if unregistered, false if not found
   */
  static unregister(type: string): boolean {
    return this.registry.delete(type)
  }

  /**
   * Clear all registrations (useful for testing)
   */
  static clear(): void {
    this.registry.clear()
  }
}
