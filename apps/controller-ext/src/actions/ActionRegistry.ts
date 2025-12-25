/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { logger } from '@/utils/logger'
import type { ActionHandler, ActionResponse } from './ActionHandler'

/**
 * ActionRegistry - Central dispatcher for all actions
 *
 * Responsibilities:
 * - Register action handlers by name
 * - Dispatch requests to correct handler
 * - Return error for unknown actions
 * - Provide introspection (list available actions)
 *
 * Usage:
 * const registry = new ActionRegistry();
 * registry.register('getActiveTab', new GetActiveTabAction());
 * const response = await registry.dispatch('getActiveTab', {});
 */
export class ActionRegistry {
  private handlers = new Map<string, ActionHandler>()

  /**
   * Register an action handler
   *
   * @param actionName - Unique action name (e.g., "getActiveTab")
   * @param handler - Action handler instance
   */
  register(actionName: string, handler: ActionHandler): void {
    if (this.handlers.has(actionName)) {
      logger.warn(
        `[ActionRegistry] Action "${actionName}" already registered, overwriting`,
      )
    }

    this.handlers.set(actionName, handler)
    logger.info(`[ActionRegistry] Registered action: ${actionName}`)
  }

  /**
   * Dispatch request to appropriate action handler
   *
   * Flow:
   * 1. Find handler for action name
   * 2. If not found, return error
   * 3. If found, delegate to handler.handle()
   * 4. Handler validates input and executes
   * 5. Return result
   *
   * @param actionName - Action to execute
   * @param payload - Action payload (unvalidated)
   * @returns Action response
   */
  async dispatch(
    actionName: string,
    payload: unknown,
  ): Promise<ActionResponse> {
    logger.debug(`[ActionRegistry] Dispatching action: ${actionName}`)

    // Check if action exists
    const handler = this.handlers.get(actionName)

    if (!handler) {
      const availableActions = Array.from(this.handlers.keys()).join(', ')
      const errorMessage = `Unknown action: "${actionName}". Available actions: ${availableActions || 'none'}`
      logger.error(`[ActionRegistry] ${errorMessage}`)
      return {
        ok: false,
        error: errorMessage,
      }
    }

    // Delegate to handler
    try {
      const response = await handler.handle(payload)
      logger.debug(
        `[ActionRegistry] Action "${actionName}" ${response.ok ? 'succeeded' : 'failed'}`,
      )
      return response
    } catch (error) {
      // Catch any unexpected errors from handler
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[ActionRegistry] Unexpected error in "${actionName}": ${errorMessage}`,
      )
      return {
        ok: false,
        error: `Action execution failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Get list of registered action names
   *
   * @returns Array of action names
   */
  getAvailableActions(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if action is registered
   *
   * @param actionName - Action name to check
   * @returns True if action exists
   */
  hasAction(actionName: string): boolean {
    return this.handlers.has(actionName)
  }

  /**
   * Get number of registered actions
   *
   * @returns Count of registered actions
   */
  getActionCount(): number {
    return this.handlers.size
  }

  /**
   * Unregister an action (useful for testing)
   *
   * @param actionName - Action to remove
   * @returns True if action was removed
   */
  unregister(actionName: string): boolean {
    const removed = this.handlers.delete(actionName)
    if (removed) {
      logger.info(`[ActionRegistry] Unregistered action: ${actionName}`)
    }
    return removed
  }

  /**
   * Clear all registered actions (useful for testing)
   */
  clear(): void {
    const count = this.handlers.size
    this.handlers.clear()
    logger.info(`[ActionRegistry] Cleared ${count} registered actions`)
  }
}
