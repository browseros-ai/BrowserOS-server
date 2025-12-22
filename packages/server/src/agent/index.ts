/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export {createHttpServer} from './http/index.js';
export {HttpServerConfigSchema, ChatRequestSchema} from './http/index.js';
export type {
  HttpServerConfig,
  ValidatedHttpServerConfig,
  ChatRequest,
} from './http/index.js';

// Alias for backwards compatibility with packages/server
export {createHttpServer as createAgentServer} from './http/index.js';
export type {HttpServerConfig as AgentServerConfig} from './http/index.js';

export {GeminiAgent, AIProvider} from './agent/index.js';
export type {AgentConfig} from './agent/index.js';

export {SessionManager} from './session/index.js';

export {KlavisClient, OAUTH_MCP_SERVERS} from './klavis/index.js';
export type {OAuthMcpServer} from './klavis/index.js';

export {
  HttpAgentError,
  ValidationError,
  SessionNotFoundError,
  AgentExecutionError,
} from './errors.js';

export {RateLimiter, RateLimitError} from './rate-limiter/index.js';
