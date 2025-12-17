/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Core module exports
export {ensureBrowserConnected} from './browser.js';
export {McpContext} from './McpContext.js';
export {Mutex} from './Mutex.js';
export {logger, Logger} from './logger.js';
export {metrics, type MetricsConfig} from './metrics.js';
export {fetchBrowserOSConfig} from './gateway.js';
export {initializeDb, getDb, closeDb} from './db/index.js';
export {identity, type IdentityConfig} from './identity.js';

// Utils exports
export * from './utils/index.js';
export {readVersion} from './utils/index.js';

// Type exports
export type {
  McpContext as McpContextType,
  TextSnapshotNode,
  TextSnapshot,
} from './McpContext.js';
export type {TraceResult} from './types.js';
export type {BrowserOSConfig, Provider, LLMConfig} from './gateway.js';
export {getLLMConfigFromProvider} from './gateway.js';
