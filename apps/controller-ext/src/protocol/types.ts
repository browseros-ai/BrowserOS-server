/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

// Request schema
export const ProtocolRequestSchema = z.object({
  id: z.string().describe('Request UUID'),
  action: z.string().min(1).describe('Action name'),
  payload: z.any().optional().describe('Action-specific data'),
});

// Response schema
export const ProtocolResponseSchema = z.object({
  id: z.string().describe('Request ID (same as request)'),
  ok: z.boolean().describe('Success flag'),
  data: z.any().optional().describe('Result data'),
  error: z.string().optional().describe('Error message'),
});

// Action response schema (used internally by action handlers)
export const ActionResponseSchema = z
  .object({
    ok: z.boolean().describe('Success flag'),
    data: z.any().optional().describe('Result data'),
    error: z.string().optional().describe('Error message'),
  })
  .refine(
    data => {
      // If ok is true, there should be no error
      if (data.ok && data.error !== undefined) {
        return false;
      }
      // If ok is false, there should be an error
      if (!data.ok && !data.error) {
        return false;
      }
      return true;
    },
    {
      message:
        'When ok is true, error must be undefined. When ok is false, error must be provided.',
    },
  );

// Type exports
export type ProtocolRequest = z.infer<typeof ProtocolRequestSchema>;
export type ProtocolResponse = z.infer<typeof ProtocolResponseSchema>;
export type ActionResponse = z.infer<typeof ActionResponseSchema>;

// Connection status enum
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}
