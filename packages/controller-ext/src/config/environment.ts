/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

/**
 * Environment Variable Management
 *
 * Centralized location for all environment variable access with type safety.
 * Environment variables are injected at build time via webpack DefinePlugin.
 * All environment variables are validated using Zod schemas.
 */

/**
 * Get environment variable as string with optional default value
 */
function getEnvString(key: string, defaultValue: string): string {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * Get environment variable as number with optional default value
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get environment variable as boolean with optional default value
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

// Zod Schemas for Environment Configuration

/**
 * WebSocket configuration schema
 */
export const WebSocketConfigSchema = z.object({
  protocol: z.enum(['ws', 'wss']).describe('WebSocket protocol (ws or wss)'),
  host: z.string().min(1).describe('WebSocket server host'),
  port: z.number().int().min(1).max(65535).describe('WebSocket server port'),
  path: z.string().describe('WebSocket server path'),

  // Connection settings
  reconnectDelay: z
    .number()
    .min(0)
    .describe('Initial reconnection delay in ms'),
  maxReconnectDelay: z
    .number()
    .min(0)
    .describe('Maximum reconnection delay in ms'),
  reconnectMultiplier: z
    .number()
    .min(1)
    .describe('Reconnection delay multiplier'),
  maxReconnectAttempts: z
    .number()
    .min(0)
    .describe('Max reconnection attempts (0 = infinite)'),

  // Heartbeat settings
  heartbeatInterval: z.number().min(0).describe('Heartbeat interval in ms'),
  heartbeatTimeout: z.number().min(0).describe('Heartbeat timeout in ms'),

  // Timeout settings
  connectionTimeout: z.number().min(0).describe('Connection timeout in ms'),
  requestTimeout: z.number().min(0).describe('Request timeout in ms'),
});

/**
 * Concurrency configuration schema
 */
export const ConcurrencyConfigSchema = z.object({
  maxConcurrent: z
    .number()
    .int()
    .min(1)
    .describe('Maximum concurrent requests'),
  maxQueueSize: z.number().int().min(1).describe('Maximum queue size'),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  enabled: z.boolean().describe('Whether logging is enabled'),
  level: z.enum(['debug', 'info', 'warn', 'error']).describe('Logging level'),
  prefix: z.string().describe('Logging prefix'),
});

/**
 * Full environment configuration schema
 */
export const EnvironmentSchema = z.object({
  websocket: WebSocketConfigSchema,
  concurrency: ConcurrencyConfigSchema,
  logging: LoggingConfigSchema,
});

// Type exports
export type WebSocketConfig = z.infer<typeof WebSocketConfigSchema>;
export type ConcurrencyConfig = z.infer<typeof ConcurrencyConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Raw environment configuration object (before validation)
 */
const envRaw = {
  // WebSocket Configuration
  websocket: {
    protocol: getEnvString('WEBSOCKET_PROTOCOL', 'ws'),
    host: getEnvString('WEBSOCKET_HOST', 'localhost'),
    port: getEnvNumber('WEBSOCKET_PORT', 9224),
    path: getEnvString('WEBSOCKET_PATH', '/controller'),

    // Connection settings
    reconnectDelay: getEnvNumber('WEBSOCKET_RECONNECT_DELAY', 1000),
    maxReconnectDelay: getEnvNumber('WEBSOCKET_MAX_RECONNECT_DELAY', 30000),
    reconnectMultiplier: parseFloat(
      getEnvString('WEBSOCKET_RECONNECT_MULTIPLIER', '1.5'),
    ),
    maxReconnectAttempts: getEnvNumber('WEBSOCKET_MAX_RECONNECT_ATTEMPTS', 0),

    // Heartbeat settings
    heartbeatInterval: getEnvNumber('WEBSOCKET_HEARTBEAT_INTERVAL', 30000),
    heartbeatTimeout: getEnvNumber('WEBSOCKET_HEARTBEAT_TIMEOUT', 5000),

    // Timeout settings
    connectionTimeout: getEnvNumber('WEBSOCKET_CONNECTION_TIMEOUT', 10000),
    requestTimeout: getEnvNumber('WEBSOCKET_REQUEST_TIMEOUT', 30000),
  },

  // Concurrency Configuration
  concurrency: {
    maxConcurrent: getEnvNumber('CONCURRENCY_MAX_CONCURRENT', 100),
    maxQueueSize: getEnvNumber('CONCURRENCY_MAX_QUEUE_SIZE', 1000),
  },

  // Logging Configuration
  logging: {
    enabled: getEnvBoolean('LOGGING_ENABLED', true),
    level: getEnvString('LOGGING_LEVEL', 'info') as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error',
    prefix: getEnvString('LOGGING_PREFIX', '[BrowserOS Controller]'),
  },
};

/**
 * Validated environment configuration object
 * Parsed and validated using Zod schemas
 */
export const env = EnvironmentSchema.parse(envRaw);

/**
 * Validate environment configuration
 * Called at startup to ensure all required environment variables are set correctly
 *
 * @returns Validation result with success flag and any error messages
 */
export function validateEnvironment(): {valid: boolean; errors: string[]} {
  try {
    EnvironmentSchema.parse(envRaw);
    return {valid: true, errors: []};
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      return {valid: false, errors};
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
