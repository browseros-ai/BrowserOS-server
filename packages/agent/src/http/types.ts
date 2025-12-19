/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {VercelAIConfigSchema} from '../agent/gemini-vercel-sdk-adapter/types.js';
import type {RateLimiter} from '../rate-limiter/index.js';

export const TabSchema = z.object({
  id: z.number(),
  url: z.string().optional(),
  title: z.string().optional(),
});

export type Tab = z.infer<typeof TabSchema>;

export const CustomMcpServerSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

export type CustomMcpServer = z.infer<typeof CustomMcpServerSchema>;

export const BrowserContextSchema = z.object({
  windowId: z.number().optional(),
  activeTab: TabSchema.optional(),
  selectedTabs: z.array(TabSchema).optional(),
  tabs: z.array(TabSchema).optional(),
  enabledMcpServers: z.array(z.string()).optional(),
  customMcpServers: z.array(CustomMcpServerSchema).optional(),
});

export type BrowserContext = z.infer<typeof BrowserContextSchema>;

export const ChatRequestSchema = VercelAIConfigSchema.extend({
  conversationId: z.string().uuid(),
  message: z.string().min(1, 'Message cannot be empty'),
  contextWindowSize: z.number().optional(),
  browserContext: BrowserContextSchema.optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface HttpServerConfig {
  port: number;
  host?: string;
  corsOrigins?: string[];
  tempDir?: string;
  mcpServerUrl?: string;
  rateLimiter?: RateLimiter;
  browserosId?: string;
}

export const HttpServerConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string().optional().default('0.0.0.0'),
  corsOrigins: z.array(z.string()).optional().default(['*']),
  tempDir: z.string().optional().default('/tmp'),
  mcpServerUrl: z.string().optional(),
});

export type ValidatedHttpServerConfig = z.infer<typeof HttpServerConfigSchema>;
