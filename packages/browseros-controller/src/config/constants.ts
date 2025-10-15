import { z } from 'zod';
import {
  env,
  WebSocketConfigSchema,
  ConcurrencyConfigSchema,
  LoggingConfigSchema
} from './environment';

/**
 * Configuration constants for the BrowserOS Controller
 *
 * All values are sourced from environment variables via the env object.
 * This file provides backwards compatibility with the existing codebase
 * while centralizing configuration management.
 * All configurations are validated using Zod schemas.
 */

/**
 * Extended WebSocket configuration schema (includes runtime transformations)
 */
export const WebSocketRuntimeConfigSchema = WebSocketConfigSchema.extend({
  maxReconnectAttempts: z.union([z.number().min(0), z.literal(Infinity)]).describe('Max reconnection attempts (0/Infinity = infinite)')
});

/**
 * WebSocket configuration with runtime values
 * Includes all environment settings plus runtime transformations
 */
export const WEBSOCKET_CONFIG = WebSocketRuntimeConfigSchema.parse({
  host: env.websocket.host,
  port: env.websocket.port,
  path: env.websocket.path,
  protocol: env.websocket.protocol,

  // Reconnection
  reconnectDelay: env.websocket.reconnectDelay,
  maxReconnectDelay: env.websocket.maxReconnectDelay,
  reconnectMultiplier: env.websocket.reconnectMultiplier,
  maxReconnectAttempts: env.websocket.maxReconnectAttempts === 0 ? Infinity : env.websocket.maxReconnectAttempts,

  // Heartbeat
  heartbeatInterval: env.websocket.heartbeatInterval,
  heartbeatTimeout: env.websocket.heartbeatTimeout,

  // Timeouts
  connectionTimeout: env.websocket.connectionTimeout,
  requestTimeout: env.websocket.requestTimeout,
});

/**
 * Concurrency configuration
 * Validated using Zod schema
 */
export const CONCURRENCY_CONFIG = ConcurrencyConfigSchema.parse({
  maxConcurrent: env.concurrency.maxConcurrent,
  maxQueueSize: env.concurrency.maxQueueSize,
});

/**
 * Logging configuration
 * Validated using Zod schema
 */
export const LOGGING_CONFIG = LoggingConfigSchema.parse({
  enabled: env.logging.enabled,
  level: env.logging.level,
  prefix: env.logging.prefix,
});

// Type exports
export type WebSocketRuntimeConfig = z.infer<typeof WebSocketRuntimeConfigSchema>;
export type ConcurrencyConfig = z.infer<typeof ConcurrencyConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
