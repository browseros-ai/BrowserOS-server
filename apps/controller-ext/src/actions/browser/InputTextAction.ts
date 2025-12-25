/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { PointerOverlay } from '@/utils/PointerOverlay'
import { SnapshotCache } from '@/utils/SnapshotCache'
import { ActionHandler } from '../ActionHandler'

// Input schema
const InputTextInputSchema = z.object({
  tabId: z.number().describe('The tab ID containing the element'),
  nodeId: z
    .number()
    .int()
    .positive()
    .describe('The nodeId from interactive snapshot'),
  text: z.string().describe('Text to type into the element'),
})

// Output schema
const InputTextOutputSchema = z.object({
  success: z.boolean().describe('Whether the input succeeded'),
})

type InputTextInput = z.infer<typeof InputTextInputSchema>
type InputTextOutput = z.infer<typeof InputTextOutputSchema>

/**
 * InputTextAction - Type text into an element by its nodeId
 *
 * This action types text into an input field or textarea identified by its nodeId.
 *
 * Prerequisites:
 * - Must call getInteractiveSnapshot first to get valid nodeIds
 * - Element must be typeable (type: 'typeable' in snapshot)
 * - NodeIds are valid only for the current page state
 *
 * Behavior:
 * - Automatically clears existing text before typing (handled by adapter)
 * - Types the full text string
 * - Triggers input/change events
 *
 * Usage:
 * 1. Get snapshot to find typeable elements
 * 2. Choose input field by nodeId
 * 3. Call inputText with tabId, nodeId, and text
 *
 * Used by: TypeTool, form automation workflows
 */
export class InputTextAction extends ActionHandler<
  InputTextInput,
  InputTextOutput
> {
  readonly inputSchema = InputTextInputSchema
  private browserOSAdapter = BrowserOSAdapter.getInstance()

  async execute(input: InputTextInput): Promise<InputTextOutput> {
    // Show pointer overlay before typing
    const rect = SnapshotCache.getNodeRect(input.tabId, input.nodeId)
    if (rect) {
      const { x, y } = PointerOverlay.getLeftCenterCoordinates(rect)
      const textPreview =
        input.text.length > 20
          ? `Type: ${input.text.substring(0, 20)}...`
          : `Type: ${input.text}`
      await PointerOverlay.showPointerAndWait(input.tabId, x, y, textPreview)
    }

    await this.browserOSAdapter.inputText(input.tabId, input.nodeId, input.text)
    return { success: true }
  }
}
