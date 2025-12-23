/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { TabAdapter } from '@/adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

// Input schema
const CloseTabInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to close'),
})

// Output schema
const CloseTabOutputSchema = z.object({
  success: z.boolean().describe('Whether the tab was successfully closed'),
  message: z.string().describe('Confirmation message'),
})

type CloseTabInput = z.infer<typeof CloseTabInputSchema>
type CloseTabOutput = z.infer<typeof CloseTabOutputSchema>

/**
 * CloseTabAction - Close a specific tab by ID
 *
 * Closes the tab with the given ID.
 *
 * Input:
 * - tabId: ID of the tab to close
 *
 * Output:
 * - success: true if tab was closed
 * - message: Confirmation message
 *
 * Usage:
 * Use this to close tabs that are no longer needed.
 * You can get tab IDs from the getTabs or openTab actions.
 *
 * Example:
 * {
 *   "tabId": 123
 * }
 * // Returns: { success: true, message: "Closed tab 123" }
 */
export class CloseTabAction extends ActionHandler<
  CloseTabInput,
  CloseTabOutput
> {
  readonly inputSchema = CloseTabInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: CloseTabInput): Promise<CloseTabOutput> {
    await this.tabAdapter.closeTab(input.tabId)

    return {
      success: true,
      message: `Closed tab ${input.tabId}`,
    }
  }
}
