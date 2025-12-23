/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Main entry point for @browseros/tools package
 */

export * as cdpTools from './cdp-based/index.js'
// Export CDP-based tools (Chrome DevTools Protocol)
// Re-export specific CDP tool categories for direct import
export {
  allCdpTools,
  console,
  emulation,
  input,
  network,
  pages,
  screenshot,
  script,
  snapshot,
} from './cdp-based/index.js'
export * as controllerTools from './controller-based/index.js'
// Export controller-based tools (BrowserOS Controller via Extension)
export { allControllerTools } from './controller-based/index.js'
// Export formatters for custom use
export * as formatters from './formatters/index.js'
// Export response handlers
export { McpResponse } from './response/index.js'
// Export types
export * from './types/index.js'
