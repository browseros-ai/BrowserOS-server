/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Advanced
export { checkAvailability, executeJavaScript, sendKeys } from './advanced.js'
// Bookmark Management
export { createBookmark, getBookmarks, removeBookmark } from './bookmarks.js'
// Content Extraction
export { getPageContent } from './content.js'
// Coordinate-based
export { clickCoordinates, typeAtCoordinates } from './coordinates.js'
// History Management
export { getRecentHistory, searchHistory } from './history.js'
// Element Interaction
export {
  clearInput,
  clickElement,
  getInteractiveElements,
  scrollToElement,
  typeText,
} from './interaction.js'
// Navigation
export { navigate } from './navigation.js'
// Screenshots
export { getScreenshot, getScreenshotPointer } from './screenshot.js'
// Scrolling
export { scrollDown, scrollUp } from './scrolling.js'
// Tab Management
export {
  closeTab,
  getActiveTab,
  getLoadStatus,
  listTabs,
  openTab,
  switchTab,
} from './tabManagement.js'
