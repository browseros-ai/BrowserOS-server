/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Categories for grouping and organizing browser automation tools
 */
export enum ToolCategories {
  // CDP categories (existing)
  INPUT_AUTOMATION = 'Input automation',
  NAVIGATION_AUTOMATION = 'Navigation automation',
  EMULATION = 'Emulation',
  PERFORMANCE = 'Performance',
  NETWORK = 'Network',
  DEBUGGING = 'Debugging',

  // Controller categories (new)
  TAB_MANAGEMENT = 'Tab Management',
  ELEMENT_INTERACTION = 'Element Interaction',
  SCROLLING = 'Scrolling',
  SCREENSHOTS = 'Screenshots',
  CONTENT_EXTRACTION = 'Content Extraction',
  ADVANCED = 'Advanced',
  COORDINATES = 'Coordinate-based',
  BOOKMARKS = 'Bookmark Management',
  HISTORY = 'History Management',
}
