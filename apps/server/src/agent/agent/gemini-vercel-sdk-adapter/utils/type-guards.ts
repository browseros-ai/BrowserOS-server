/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Type guards for Gemini Part types
 * Enable TypeScript to narrow types for type safety
 */

import type { FunctionCall, FunctionResponse, Part } from '@google/genai'

/**
 * Check if part contains text
 */
export function isTextPart(part: Part): part is Part & { text: string } {
  return 'text' in part && typeof part.text === 'string'
}

/**
 * Check if part contains function call
 */
export function isFunctionCallPart(
  part: Part,
): part is Part & { functionCall: FunctionCall } {
  return 'functionCall' in part && part.functionCall !== undefined
}

/**
 * Check if part contains function response
 */
export function isFunctionResponsePart(
  part: Part,
): part is Part & { functionResponse: FunctionResponse } {
  return 'functionResponse' in part && part.functionResponse !== undefined
}

/**
 * Check if part contains inline data (images, etc.)
 */
export function isInlineDataPart(
  part: Part,
): part is Part & { inlineData: { mimeType: string; data: string } } {
  return (
    'inlineData' in part &&
    typeof part.inlineData === 'object' &&
    part.inlineData !== null &&
    'mimeType' in part.inlineData &&
    'data' in part.inlineData
  )
}

/**
 * Check if part contains file data
 */
export function isFileDataPart(
  part: Part,
): part is Part & { fileData: { mimeType: string; fileUri: string } } {
  return (
    'fileData' in part &&
    typeof part.fileData === 'object' &&
    part.fileData !== null &&
    'mimeType' in part.fileData &&
    'fileUri' in part.fileData
  )
}

/**
 * Check if mime type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}
