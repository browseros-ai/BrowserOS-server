/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'

import { CustomMcpServerSchema } from '../../http/types.js'

import { VercelAIConfigSchema } from './gemini-vercel-sdk-adapter/types.js'

export const AgentConfigSchema = VercelAIConfigSchema.extend({
  conversationId: z.string(),
  tempDir: z.string(),
  mcpServerUrl: z.string().optional(),
  contextWindowSize: z.number().optional(),
  browserosId: z.string().optional(),
  enabledMcpServers: z.array(z.string()).optional(),
  customMcpServers: z.array(CustomMcpServerSchema).optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>
