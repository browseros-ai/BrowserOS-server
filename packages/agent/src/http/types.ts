import { z } from 'zod';
import { VercelAIConfigSchema } from '../agent/gemini-vercel-sdk-adapter/types.js';

export const ChatRequestSchema = VercelAIConfigSchema.extend({
  conversationId: z.string().uuid(),
  message: z.string().min(1, 'Message cannot be empty'),
  contextWindowSize: z.number().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface HttpServerConfig {
  port: number;
  host?: string;
  corsOrigins?: string[];
  tempDir?: string;
  mcpServerUrl?: string;
}

export const HttpServerConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string().optional().default('0.0.0.0'),
  corsOrigins: z.array(z.string()).optional().default(['*']),
  tempDir: z.string().optional().default('/tmp'),
  mcpServerUrl: z.string().optional(),
});

export type ValidatedHttpServerConfig = z.infer<typeof HttpServerConfigSchema>;
