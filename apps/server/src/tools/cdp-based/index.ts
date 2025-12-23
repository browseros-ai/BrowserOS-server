/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type { ToolDefinition } from '../types/ToolDefinition.js'

import * as consoleTools from './console.js'
import * as networkTools from './network.js'

/**
 * All available CDP-based browser automation tools
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allCdpTools: Array<ToolDefinition<any>> = [
  //FIXME: nikhil - figure out the better wway to enable/disable tools
  ...Object.values(consoleTools),
  // ...Object.values(emulationTools),
  // ...Object.values(inputTools),
  ...Object.values(networkTools),
  // ...Object.values(pagesTools),
  // Performance tools disabled due to chrome-devtools-frontend dependency issues
  // ...Object.values(performanceTools),
  // ...Object.values(screenshotTools),
  // ...Object.values(scriptTools),
  // ...Object.values(snapshotTools),
]

// Re-export individual tool modules for selective imports
export * as console from './console.js'
export * as emulation from './emulation.js'
export * as input from './input.js'
export * as network from './network.js'
export * as pages from './pages.js'
// export * as performance from './performance.js';
export * as screenshot from './screenshot.js'
export * as script from './script.js'
export * as snapshot from './snapshot.js'
