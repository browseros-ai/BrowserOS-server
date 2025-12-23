/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { ActionHandler } from '../ActionHandler'

const GetAccessibilityTreeInputSchema = z.object({
  tabId: z
    .number()
    .int()
    .positive()
    .describe('Tab ID to get accessibility tree from'),
})

type GetAccessibilityTreeInput = z.infer<typeof GetAccessibilityTreeInputSchema>
export type GetAccessibilityTreeOutput = chrome.browserOS.AccessibilityTree

/**
 * GetAccessibilityTreeAction - Get accessibility tree for a tab
 *
 * Returns the full accessibility tree structure containing:
 * - rootId: The root node ID
 * - nodes: Map of node IDs to accessibility nodes
 *
 * Each node contains:
 * - nodeId: Unique node identifier
 * - role: Accessibility role (e.g., 'staticText', 'heading', 'button')
 * - name: Text content or label
 * - childIds: Array of child node IDs
 *
 * Example payload:
 * {
 *   "tabId": 123
 * }
 */
export class GetAccessibilityTreeAction extends ActionHandler<
  GetAccessibilityTreeInput,
  GetAccessibilityTreeOutput
> {
  readonly inputSchema = GetAccessibilityTreeInputSchema
  private browserOSAdapter = BrowserOSAdapter.getInstance()

  async execute(
    input: GetAccessibilityTreeInput,
  ): Promise<GetAccessibilityTreeOutput> {
    const { tabId } = input
    const tree = await this.browserOSAdapter.getAccessibilityTree(tabId)
    return tree
  }
}
