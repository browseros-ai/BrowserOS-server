/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Minimal context interface for controller tools.
 * Acts as a proxy to the WebSocket connection.
 */
export interface Context {
  /**
   * Execute an action on the extension
   * @param action - Action name (e.g., 'getActiveTab', 'click')
   * @param payload - Action-specific parameters
   * @returns Promise with action result
   */
  executeAction(action: string, payload: unknown): Promise<unknown>;

  /**
   * Check if extension is currently connected
   * @returns true if WebSocket connection is open
   */
  isConnected(): boolean;
}
