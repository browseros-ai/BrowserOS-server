/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type {
  InteractiveNode,
  InteractiveSnapshot,
  Rect,
} from '@/adapters/BrowserOSAdapter'
import { logger } from '@/utils/Logger'

/**
 * SnapshotCache - Caches interactive snapshots per tabId for multi-agent support
 *
 * Used to lookup element coordinates from nodeId without re-fetching snapshot.
 * This enables showing mouse pointer before click/type actions with minimal latency.
 */
class SnapshotCacheImpl {
  private cache: Map<number, InteractiveSnapshot> = new Map()
  private nodeRectCache: Map<number, Map<number, Rect>> = new Map()

  /**
   * Cache a snapshot for a tab
   */
  set(tabId: number, snapshot: InteractiveSnapshot): void {
    this.cache.set(tabId, snapshot)

    const rectMap = new Map<number, Rect>()
    for (const element of snapshot.elements) {
      if (element.rect) {
        rectMap.set(element.nodeId, element.rect)
      }
    }
    this.nodeRectCache.set(tabId, rectMap)

    logger.debug(
      `[SnapshotCache] Cached snapshot for tab ${tabId} with ${snapshot.elements.length} elements`,
    )
  }

  /**
   * Get cached snapshot for a tab
   */
  get(tabId: number): InteractiveSnapshot | undefined {
    return this.cache.get(tabId)
  }

  /**
   * Get element rect by nodeId from cache
   */
  getNodeRect(tabId: number, nodeId: number): Rect | undefined {
    const rectMap = this.nodeRectCache.get(tabId)
    if (!rectMap) {
      logger.debug(`[SnapshotCache] No cached snapshot for tab ${tabId}`)
      return undefined
    }
    return rectMap.get(nodeId)
  }

  /**
   * Get element by nodeId from cache
   */
  getElement(tabId: number, nodeId: number): InteractiveNode | undefined {
    const snapshot = this.cache.get(tabId)
    if (!snapshot) {
      return undefined
    }
    return snapshot.elements.find((el) => el.nodeId === nodeId)
  }

  /**
   * Clear cache for a specific tab
   */
  clear(tabId: number): void {
    this.cache.delete(tabId)
    this.nodeRectCache.delete(tabId)
    logger.debug(`[SnapshotCache] Cleared cache for tab ${tabId}`)
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.cache.clear()
    this.nodeRectCache.clear()
    logger.debug('[SnapshotCache] Cleared all caches')
  }

  /**
   * Check if snapshot is cached for a tab
   */
  has(tabId: number): boolean {
    return this.cache.has(tabId)
  }
}

export const SnapshotCache = new SnapshotCacheImpl()
