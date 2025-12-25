/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { logger } from '@/utils/logger'

/**
 * HistoryAdapter - Wrapper for Chrome history API
 *
 * Responsibilities:
 * - Provide clean Promise-based interface to Chrome history API
 * - Handle Chrome API errors
 * - Log operations for debugging
 */
export class HistoryAdapter {
  /**
   * Search browser history
   *
   * @param query - Search query (matches URL and title)
   * @param maxResults - Maximum number of results (default: 100)
   * @param startTime - Start time in milliseconds since epoch (optional)
   * @param endTime - End time in milliseconds since epoch (optional)
   * @returns Array of history items
   */
  async searchHistory(
    query: string,
    maxResults = 100,
    startTime?: number,
    endTime?: number,
  ): Promise<chrome.history.HistoryItem[]> {
    logger.debug(
      `[HistoryAdapter] Searching history: "${query}" (max: ${maxResults})`,
    )

    try {
      const results = await chrome.history.search({
        text: query,
        maxResults,
        startTime,
        endTime,
      })

      logger.debug(`[HistoryAdapter] Found ${results.length} history items`)
      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[HistoryAdapter] Failed to search history: ${errorMessage}`)
      throw new Error(`Failed to search history: ${errorMessage}`)
    }
  }

  /**
   * Get recent browser history
   *
   * @param maxResults - Maximum number of results (default: 20)
   * @param hoursBack - How many hours back to search (default: 24)
   * @returns Array of recent history items
   */
  async getRecentHistory(
    maxResults = 20,
    hoursBack = 24,
  ): Promise<chrome.history.HistoryItem[]> {
    logger.debug(
      `[HistoryAdapter] Getting ${maxResults} recent history items (last ${hoursBack}h)`,
    )

    try {
      const startTime = Date.now() - hoursBack * 60 * 60 * 1000

      const results = await chrome.history.search({
        text: '',
        maxResults,
        startTime,
      })

      logger.debug(`[HistoryAdapter] Retrieved ${results.length} recent items`)
      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[HistoryAdapter] Failed to get recent history: ${errorMessage}`,
      )
      throw new Error(`Failed to get recent history: ${errorMessage}`)
    }
  }

  /**
   * Get visit details for a specific URL
   *
   * @param url - URL to get visits for
   * @returns Array of visit items
   */
  async getVisits(url: string): Promise<chrome.history.VisitItem[]> {
    logger.debug(`[HistoryAdapter] Getting visits for: ${url}`)

    try {
      const visits = await chrome.history.getVisits({ url })
      logger.debug(`[HistoryAdapter] Found ${visits.length} visits for ${url}`)
      return visits
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[HistoryAdapter] Failed to get visits: ${errorMessage}`)
      throw new Error(`Failed to get visits: ${errorMessage}`)
    }
  }

  /**
   * Add a URL to browser history
   *
   * @param url - URL to add
   */
  async addUrl(url: string): Promise<void> {
    logger.debug(`[HistoryAdapter] Adding URL to history: ${url}`)

    try {
      await chrome.history.addUrl({ url })
      logger.debug(`[HistoryAdapter] Added URL: ${url}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[HistoryAdapter] Failed to add URL: ${errorMessage}`)
      throw new Error(`Failed to add URL to history: ${errorMessage}`)
    }
  }

  /**
   * Remove a specific URL from history
   *
   * @param url - URL to remove
   */
  async deleteUrl(url: string): Promise<void> {
    logger.debug(`[HistoryAdapter] Removing URL from history: ${url}`)

    try {
      await chrome.history.deleteUrl({ url })
      logger.debug(`[HistoryAdapter] Removed URL: ${url}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[HistoryAdapter] Failed to delete URL: ${errorMessage}`)
      throw new Error(`Failed to delete URL from history: ${errorMessage}`)
    }
  }

  /**
   * Delete history within a time range
   *
   * @param startTime - Start time in milliseconds since epoch
   * @param endTime - End time in milliseconds since epoch
   */
  async deleteRange(startTime: number, endTime: number): Promise<void> {
    logger.debug(
      `[HistoryAdapter] Deleting history range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`,
    )

    try {
      await chrome.history.deleteRange({ startTime, endTime })
      logger.debug('[HistoryAdapter] Deleted history range')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[HistoryAdapter] Failed to delete history range: ${errorMessage}`,
      )
      throw new Error(`Failed to delete history range: ${errorMessage}`)
    }
  }

  /**
   * Delete all browser history
   *
   * WARNING: This deletes ALL history permanently!
   */
  async deleteAll(): Promise<void> {
    logger.warn('[HistoryAdapter] Deleting ALL browser history')

    try {
      await chrome.history.deleteAll()
      logger.warn('[HistoryAdapter] Deleted all history')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[HistoryAdapter] Failed to delete all history: ${errorMessage}`,
      )
      throw new Error(`Failed to delete all history: ${errorMessage}`)
    }
  }

  /**
   * Get most visited URLs
   *
   * @param maxResults - Maximum number of results (default: 10)
   * @returns Array of most visited history items
   */
  async getMostVisited(maxResults = 10): Promise<chrome.history.HistoryItem[]> {
    logger.debug(`[HistoryAdapter] Getting ${maxResults} most visited URLs`)

    try {
      // Get all recent history
      const allHistory = await chrome.history.search({
        text: '',
        maxResults: 1000, // Get a large sample
        startTime: 0,
      })

      // Sort by visit count
      const sorted = allHistory
        .filter((item) => item.visitCount && item.visitCount > 1)
        .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        .slice(0, maxResults)

      logger.debug(`[HistoryAdapter] Found ${sorted.length} most visited URLs`)
      return sorted
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[HistoryAdapter] Failed to get most visited: ${errorMessage}`,
      )
      throw new Error(`Failed to get most visited URLs: ${errorMessage}`)
    }
  }
}
