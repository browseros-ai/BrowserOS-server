/**
 * @license
 * Copyright 2025 BrowserOS
 */
import * as consoleTools from './console.js';
import * as emulationTools from './emulation.js';
import * as inputTools from './input.js';
import * as networkTools from './network.js';
import * as pagesTools from './pages.js';
// Performance tools lazy-loaded to avoid chrome-devtools-frontend imports at startup
// import * as performanceTools from './performance.js';
import * as screenshotTools from './screenshot.js';
import * as scriptTools from './script.js';
import * as snapshotTools from './snapshot.js';

export const allTools = [
  ...Object.values(consoleTools),
  ...Object.values(emulationTools),
  ...Object.values(inputTools),
  ...Object.values(networkTools),
  ...Object.values(pagesTools),
  // Performance tools disabled due to chrome-devtools-frontend dependency issues
  // ...Object.values(performanceTools),
  ...Object.values(screenshotTools),
  ...Object.values(scriptTools),
  ...Object.values(snapshotTools),
];
