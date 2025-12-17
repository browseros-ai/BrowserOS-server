/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
