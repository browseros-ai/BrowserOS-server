import { z } from 'zod';
import { VercelAIConfigSchema } from './gemini-vercel-sdk-adapter/types.js';

export const AgentConfigSchema = VercelAIConfigSchema.extend({
  conversationId: z.string(),
  tempDir: z.string(),
  mcpServerUrl: z.string().optional(),
  // Context window configuration for history compression
  contextWindowSize: z.number().optional(), // Model's actual context window in tokens (default: 1000000)
  compressionRatio: z.number().min(0).max(1).optional(), // Compress when history reaches this % of context (default: 0.75)
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;