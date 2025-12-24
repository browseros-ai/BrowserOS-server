/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import {
  BrowserOSAdapter,
  type ScreenshotSizeKey,
} from '@/adapters/BrowserOSAdapter'
import { logger } from '@/utils/Logger'
import { PointerOverlay } from '@/utils/PointerOverlay'
import { SnapshotCache } from '@/utils/SnapshotCache'
import { ActionHandler } from '../ActionHandler'

// Input schema
const CaptureScreenshotPointerInputSchema = z.object({
  tabId: z.number().describe('The tab ID to capture'),
  nodeId: z
    .number()
    .int()
    .positive()
    .describe('The nodeId to show pointer over'),
  size: z
    .enum(['small', 'medium', 'large'])
    .optional()
    .default('medium')
    .describe('Screenshot size preset (default: medium)'),
  pointerLabel: z
    .string()
    .optional()
    .describe('Optional label to show with pointer (e.g., "Click", "Type")'),
})

// Output schema
const CaptureScreenshotPointerOutputSchema = z.object({
  dataUrl: z.string().describe('Base64-encoded PNG data URL'),
  pointerPosition: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional()
    .describe('Coordinates where pointer was shown'),
})

type CaptureScreenshotPointerInput = z.infer<
  typeof CaptureScreenshotPointerInputSchema
>
type CaptureScreenshotPointerOutput = z.infer<
  typeof CaptureScreenshotPointerOutputSchema
>

/**
 * CaptureScreenshotPointerAction - Show pointer over element and capture screenshot
 *
 * Shows a visual pointer overlay at the center of the specified element,
 * then captures a screenshot with the pointer visible.
 *
 * Prerequisites:
 * - Must call getInteractiveSnapshot first to populate the cache
 * - NodeId must exist in the cached snapshot
 *
 * Usage:
 * 1. Get snapshot to find elements and populate cache
 * 2. Call captureScreenshotPointer with tabId and nodeId
 * 3. Returns screenshot with pointer overlay visible
 *
 * Used by: Visual debugging, automation demos, step-by-step captures
 */
export class CaptureScreenshotPointerAction extends ActionHandler<
  CaptureScreenshotPointerInput,
  CaptureScreenshotPointerOutput
> {
  readonly inputSchema = CaptureScreenshotPointerInputSchema
  private browserOSAdapter = BrowserOSAdapter.getInstance()

  async execute(
    input: CaptureScreenshotPointerInput,
  ): Promise<CaptureScreenshotPointerOutput> {
    const { tabId, nodeId, size, pointerLabel } = input

    // Get element rect from cache
    const rect = SnapshotCache.getNodeRect(tabId, nodeId)

    let pointerPosition: { x: number; y: number } | undefined

    if (rect) {
      // Calculate center coordinates
      const { x, y } = PointerOverlay.getCenterCoordinates(rect)
      pointerPosition = { x, y }

      // Show pointer
      await PointerOverlay.showPointer(tabId, x, y, pointerLabel)

      logger.debug(
        `[CaptureScreenshotPointerAction] Showed pointer at (${x}, ${y}) for node ${nodeId}`,
      )
    } else {
      logger.warn(
        `[CaptureScreenshotPointerAction] No cached rect for node ${nodeId} in tab ${tabId}. Capturing without pointer.`,
      )
    }

    // Small delay to ensure pointer is rendered
    await this.delay(100)

    // Capture screenshot with pointer visible
    const dataUrl = await this.browserOSAdapter.captureScreenshot(
      tabId,
      size as ScreenshotSizeKey | undefined,
      false, // Don't show highlights, we have the pointer
    )

    return {
      dataUrl,
      pointerPosition,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
