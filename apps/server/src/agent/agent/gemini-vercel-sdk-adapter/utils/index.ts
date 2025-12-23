/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utilities barrel export
 * Single entry point for all utility functions
 */

export { createOpenRouterCompatibleFetch } from './fetch.js'
export {
  isFileDataPart,
  isFunctionCallPart,
  isFunctionResponsePart,
  isImageMimeType,
  isInlineDataPart,
  isTextPart,
} from './type-guards.js'
