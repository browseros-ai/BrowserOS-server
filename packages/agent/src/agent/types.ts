import { z } from 'zod';
import { VercelAIConfigSchema } from './gemini-vercel-sdk-adapter/types.js';

export const AgentConfigSchema = VercelAIConfigSchema.extend({
  conversationId: z.string(),
  tempDir: z.string(),
  mcpServerUrl: z.string().optional(),
  contextWindowSize: z.number().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
