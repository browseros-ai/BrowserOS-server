/**
 * @license
 * Copyright 2025 BrowserOS
 */

/**
 * Utilities barrel export
 * Single entry point for all utility functions
 */

export {
  isTextPart,
  isFunctionCallPart,
  isFunctionResponsePart,
  isInlineDataPart,
  isFileDataPart,
  isImageMimeType,
} from './type-guards.js';

export {createOpenRouterCompatibleFetch} from './fetch.js';
