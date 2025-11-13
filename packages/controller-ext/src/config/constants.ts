/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type WebSocketProtocol = 'ws' | 'wss';

export interface WebSocketConfig {
  readonly protocol: WebSocketProtocol;
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly reconnectIntervalMs: number;
  readonly heartbeatInterval: number;
  readonly heartbeatTimeout: number;
  readonly connectionTimeout: number;
  readonly requestTimeout: number;
}

export interface ConcurrencyConfig {
  readonly maxConcurrent: number;
  readonly maxQueueSize: number;
}

export interface LoggingConfig {
  readonly enabled: boolean;
  readonly level: LogLevel;
  readonly prefix: string;
}

export const WEBSOCKET_CONFIG: WebSocketConfig = {
  protocol: 'ws',
  host: 'localhost',
  port: 9225,
  path: '/controller',

  reconnectIntervalMs: 30000,

  heartbeatInterval: 20000,
  heartbeatTimeout: 5000,

  connectionTimeout: 10000,
  requestTimeout: 30000,
};

export const CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 1,
  maxQueueSize: 1000,
};

export const LOGGING_CONFIG: LoggingConfig = {
  enabled: true,
  level: 'info',
  prefix: '',
};
