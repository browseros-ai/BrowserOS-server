/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { TabAdapter } from '@/adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

// Input schema
const SwitchTabInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to switch to'),
})

// Output schema
const SwitchTabOutputSchema = z.object({
  tabId: z.number().describe('ID of the tab that is now active'),
  url: z.string().describe('URL of the active tab'),
  title: z.string().describe('Title of the active tab'),
})

type SwitchTabInput = z.infer<typeof SwitchTabInputSchema>
type SwitchTabOutput = z.infer<typeof SwitchTabOutputSchema>

/**
 * SwitchTabAction - Switch to (focus) a specific tab
 *
 * Makes the specified tab the active tab in its window.
 *
 * Input:
 * - tabId: ID of the tab to switch to
 *
 * Output:
 * - tabId: ID of the now-active tab
 * - url: URL of the active tab
 * - title: Title of the active tab
 *
 * Usage:
 * Use this to switch between tabs. Get tab IDs from the getTabs action.
 *
 * Example:
 * {
 *   "tabId": 123
 * }
 * // Returns: { tabId: 123, url: "https://google.com", title: "Google" }
 */
export class SwitchTabAction extends ActionHandler<
  SwitchTabInput,
  SwitchTabOutput
> {
  readonly inputSchema = SwitchTabInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: SwitchTabInput): Promise<SwitchTabOutput> {
    const tab = await this.tabAdapter.switchTab(input.tabId)

    if (tab.id === undefined) {
      throw new Error('Switched tab has no ID')
    }
    return {
      tabId: tab.id,
      url: tab.url || '',
      title: tab.title || '',
    }
  }
}
