/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Test helpers public API.
 */

// Setup & lifecycle
export {
  cleanupBrowserOS,
  ensureBrowserOS,
  type TestEnvironmentConfig,
} from './setup.js'
// Types
export type { McpContentItem, TypedCallToolResult } from './utils.js'
// Test wrappers
// Port management
// Mocks
export {
  asToolResult,
  getMockRequest,
  getMockResponse,
  html,
  killProcessOnPort,
  withBrowser,
  withMcpServer,
} from './utils.js'
