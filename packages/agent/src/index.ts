/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Public API exports for integration with main server
export {createServer as createAgentServer} from './websocket/server.js';
export {ServerConfigSchema as AgentServerConfigSchema} from './websocket/server.js';
export type {ServerConfig as AgentServerConfig} from './websocket/server.js';
export type {ControllerBridge} from '@browseros/controller-server';

// Agent factory exports
export {AgentFactory} from './agent/AgentFactory.js';
export type {AgentConstructor} from './agent/AgentFactory.js';
export {registerAgents} from './agent/registry.js';
export {BaseAgent} from './agent/BaseAgent.js';
