/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized limits and thresholds.
 */

export const RATE_LIMITS = {
  DEFAULT_DAILY: 5,
  DEV_DAILY: 100,
  TEST_DAILY: Infinity,
} as const

export const AGENT_LIMITS = {
  MAX_TURNS: 100,
  DEFAULT_CONTEXT_WINDOW: 1_000_000,
  DEFAULT_COMPRESSION_RATIO: 0.75,
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
} as const

export const CONTENT_LIMITS = {
  BODY_CONTEXT_SIZE: 10_000,
  MAX_QUEUE_SIZE: 1_000,
  CONSOLE_META_CHAR: 100,
} as const
