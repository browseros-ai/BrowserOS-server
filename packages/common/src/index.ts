/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Core module exports
export {ensureBrowserConnected} from './browser.js';
export {McpContext} from './McpContext.js';
export {Mutex} from './Mutex.js';
export {logger} from './logger.js';
export {metrics} from './metrics.js';
export {fetchBrowserOSConfig} from './gateway.js';

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
export type {BrowserOSConfig, Provider} from './gateway.js';
