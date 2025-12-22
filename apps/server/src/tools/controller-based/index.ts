/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Types
export type {Context} from './types/Context.js';
export type {Response, ImageContentData} from './types/Response.js';

// Response implementation
export {ControllerResponse} from './response/ControllerResponse.js';

// Utilities
export {parseDataUrl} from './utils/parseDataUrl.js';

// All controller tools (named exports)
export * from './tools/index.js';

// Import all tools for the array export
import {
  executeJavaScript,
  sendKeys,
  checkAvailability,
} from './tools/advanced.js';
import {
  getBookmarks,
  createBookmark,
  removeBookmark,
} from './tools/bookmarks.js';
import {getPageContent} from './tools/content.js';
import {clickCoordinates, typeAtCoordinates} from './tools/coordinates.js';
import {searchHistory, getRecentHistory} from './tools/history.js';
import {
  getInteractiveElements,
  clickElement,
  typeText,
  clearInput,
  scrollToElement,
} from './tools/interaction.js';
import {navigate} from './tools/navigation.js';
import {getScreenshot} from './tools/screenshot.js';
import {scrollDown, scrollUp} from './tools/scrolling.js';
import {
  getActiveTab,
  listTabs,
  openTab,
  closeTab,
  switchTab,
  getLoadStatus,
} from './tools/tabManagement.js';

// Array export for convenience (27 tools)
export const allControllerTools = [
  getActiveTab,
  listTabs,
  openTab,
  closeTab,
  switchTab,
  getLoadStatus,
  navigate,
  getInteractiveElements,
  clickElement,
  typeText,
  clearInput,
  scrollToElement,
  scrollDown,
  scrollUp,
  getScreenshot,
  getPageContent,
  executeJavaScript,
  sendKeys,
  checkAvailability,
  clickCoordinates,
  typeAtCoordinates,
  getBookmarks,
  createBookmark,
  removeBookmark,
  searchHistory,
  getRecentHistory,
];
