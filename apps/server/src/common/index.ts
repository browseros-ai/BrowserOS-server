/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Core module exports
export { ensureBrowserConnected } from './browser.js'
export { closeDb, getDb, initializeDb } from './db/index.js'
export type { BrowserOSConfig, LLMConfig, Provider } from './gateway.js'
export { fetchBrowserOSConfig, getLLMConfigFromProvider } from './gateway.js'
export { type IdentityConfig, identity } from './identity.js'
export { Logger, logger } from './logger.js'
// Type exports
export type {
  McpContext as McpContextType,
  TextSnapshot,
  TextSnapshotNode,
} from './McpContext.js'
export { McpContext } from './McpContext.js'
export { Mutex } from './Mutex.js'
export { type MetricsConfig, metrics } from './metrics.js'
export type { TraceResult } from './types.js'
