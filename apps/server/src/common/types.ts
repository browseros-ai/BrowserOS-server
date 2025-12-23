/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Shared types for core package

export interface TraceResult {
  name: string
  data: unknown
}

export const ERRORS = {
  CLOSE_PAGE:
    'The last open page cannot be closed. It is fine to keep it open.',
} as const
