/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Tab Management
export {
  getActiveTab,
  listTabs,
  openTab,
  closeTab,
  switchTab,
  getLoadStatus,
} from './tabManagement.js';

// Navigation
export {navigate} from './navigation.js';

// Element Interaction
export {
  getInteractiveElements,
  clickElement,
  typeText,
  clearInput,
  scrollToElement,
} from './interaction.js';

// Scrolling
export {scrollDown, scrollUp} from './scrolling.js';

// Screenshots
export {getScreenshot} from './screenshot.js';

// Content Extraction
export {getPageContent} from './content.js';

// Advanced
export {executeJavaScript, sendKeys, checkAvailability} from './advanced.js';

// Coordinate-based
export {clickCoordinates, typeAtCoordinates} from './coordinates.js';

// Bookmark Management
export {getBookmarks, createBookmark, removeBookmark} from './bookmarks.js';

// History Management
export {searchHistory, getRecentHistory} from './history.js';
