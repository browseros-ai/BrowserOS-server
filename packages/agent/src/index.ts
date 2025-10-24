/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Public API exports for integration with main server
export { createServer as createAgentServer } from './websocket/server.js'
export { ServerConfigSchema as AgentServerConfigSchema } from './websocket/server.js'
export type { ServerConfig as AgentServerConfig } from './websocket/server.js'
export type { ControllerBridge } from '@browseros/controller-server'

// Agent exports
export { ClaudeSDKAgent } from './agent/ClaudeSDKAgent.js'
export { CodexSDKAgent } from './agent/CodexSDKAgent.js'
export type { AgentType } from './session/SessionManager.js'
