/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const WEBSOCKET_CONFIG = {
  protocol: 'ws',
  host: 'localhost',
  port: 9224,
  path: '/controller',

  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectMultiplier: 1.5,
  maxReconnectAttempts: Infinity,

  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,

  connectionTimeout: 10000,
  requestTimeout: 30000,
} as const;

export const CONCURRENCY_CONFIG = {
  maxConcurrent: 100,
  maxQueueSize: 1000,
} as const;

export const LOGGING_CONFIG = {
  enabled: true,
  level: 'info',
  prefix: '[BrowserOS Controller]',
} as const;

export type WebSocketConfig = typeof WEBSOCKET_CONFIG;
export type ConcurrencyConfig = typeof CONCURRENCY_CONFIG;
export type LoggingConfig = typeof LOGGING_CONFIG;
