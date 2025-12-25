/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized timeout configuration.
 */

export const TIMEOUTS = {
  // Agent/Tool execution
  TOOL_CALL: 120_000,
  TEST_PROVIDER: 15_000,

  // Controller communication
  CONTROLLER_DEFAULT: 60_000,
  CONTROLLER_BRIDGE: 30_000,

  // MCP operations
  MCP_DEFAULT: 5_000,

  // Navigation/DOM
  NAVIGATION: 10_000,
  STABLE_DOM: 3_000,
  FILE_CHOOSER: 3_000,

  // WebSocket (controller-ext)
  WS_RECONNECT_INTERVAL: 5_000,
  WS_HEARTBEAT_INTERVAL: 20_000,
  WS_HEARTBEAT_TIMEOUT: 5_000,
  WS_CONNECTION_TIMEOUT: 10_000,
  WS_REQUEST_TIMEOUT: 30_000,
} as const

export type TimeoutKey = keyof typeof TIMEOUTS
