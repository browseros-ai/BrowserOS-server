/**
 * @license
 * Copyright 2025 BrowserOS
 */

import {z} from 'zod';

/**
 * MESSAGE PROTOCOL
 *
 * Client → Server: ClientMessage
 * Server → Client: ServerEvent
 */

// ============================================================================
// CLIENT → SERVER MESSAGES
// ============================================================================

/**
 * Regular message from client
 */
export const ClientRegularMessageSchema = z.object({
  type: z.literal('message'),
  content: z.string().min(1, 'Message content cannot be empty'),
});

/**
 * Cancel message from client
 */
export const ClientCancelMessageSchema = z.object({
  type: z.literal('cancel'),
  sessionId: z.string().optional(),
});

/**
 * Discriminated union of all client message types
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  ClientRegularMessageSchema,
  ClientCancelMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ============================================================================
// SERVER → CLIENT EVENTS
// ============================================================================

/**
 * Connection confirmation event
 */
export const ConnectionEventSchema = z.object({
  type: z.literal('connection'),
  data: z.object({
    status: z.literal('connected'),
    sessionId: z.string(),
    timestamp: z.number(),
  }),
});

export type ConnectionEvent = z.infer<typeof ConnectionEventSchema>;

/**
 * Agent event (init, response, tool_use, tool_result, completion, error)
 * Uses FormattedEvent structure from Phase 1
 */
export const AgentEventSchema = z.object({
  type: z.enum([
    'init',
    'thinking',
    'tool_use',
    'tool_result',
    'response',
    'completion',
    'error',
  ]),
  content: z.string(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

/**
 * Cancelled event (acknowledgment of cancel request)
 */
export const CancelledEventSchema = z.object({
  type: z.literal('cancelled'),
  sessionId: z.string(),
  message: z.string().optional(),
});

export type CancelledEvent = z.infer<typeof CancelledEventSchema>;

/**
 * Error event
 */
export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
  code: z.string().optional(),
});

export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/**
 * Union of all server event types
 */
export const ServerEventSchema = z.union([
  ConnectionEventSchema,
  AgentEventSchema,
  CancelledEventSchema,
  ErrorEventSchema,
]);

export type ServerEvent = z.infer<typeof ServerEventSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a client message
 * @throws {z.ZodError} if validation fails
 */
export function validateClientMessage(data: unknown): ClientMessage {
  return ClientMessageSchema.parse(data);
}

/**
 * Try to parse a client message, returning null on error
 */
export function tryParseClientMessage(data: unknown): ClientMessage | null {
  const result = ClientMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate a server event
 * @throws {z.ZodError} if validation fails
 */
export function validateServerEvent(data: unknown): ServerEvent {
  return ServerEventSchema.parse(data);
}
