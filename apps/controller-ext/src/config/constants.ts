/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { CONTENT_LIMITS } from '@browseros/shared/limits'
import { DEFAULT_PORTS } from '@browseros/shared/ports'
import { TIMEOUTS } from '@browseros/shared/timeouts'
export type WebSocketProtocol = 'ws' | 'wss'

export interface WebSocketConfig {
  readonly protocol: WebSocketProtocol
  readonly host: string
  readonly path: string
  readonly defaultExtensionPort: number
  readonly reconnectIntervalMs: number
  readonly heartbeatInterval: number
  readonly heartbeatTimeout: number
  readonly connectionTimeout: number
  readonly requestTimeout: number
}

export interface ConcurrencyConfig {
  readonly maxConcurrent: number
  readonly maxQueueSize: number
}

export interface LoggingConfig {
  readonly enabled: boolean
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly prefix: string
}

export const WEBSOCKET_CONFIG: WebSocketConfig = {
  protocol: 'ws',
  host: '127.0.0.1',
  path: '/controller',
  defaultExtensionPort: DEFAULT_PORTS.extension,

  reconnectIntervalMs: TIMEOUTS.WS_RECONNECT_INTERVAL,

  heartbeatInterval: TIMEOUTS.WS_HEARTBEAT_INTERVAL,
  heartbeatTimeout: TIMEOUTS.WS_HEARTBEAT_TIMEOUT,

  connectionTimeout: TIMEOUTS.WS_CONNECTION_TIMEOUT,
  requestTimeout: TIMEOUTS.WS_REQUEST_TIMEOUT,
}

export const CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 1,
  maxQueueSize: CONTENT_LIMITS.MAX_QUEUE_SIZE,
}

export const LOGGING_CONFIG: LoggingConfig = {
  enabled: true,
  level: 'info',
  prefix: '',
}
