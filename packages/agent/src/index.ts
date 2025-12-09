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

export {
  HttpAgentError,
  ValidationError,
  SessionNotFoundError,
  AgentExecutionError,
} from './errors.js';
