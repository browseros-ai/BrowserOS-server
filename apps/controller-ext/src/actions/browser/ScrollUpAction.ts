/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { ActionHandler } from '../ActionHandler'

// Input schema
const ScrollUpInputSchema = z.object({
  tabId: z.number().describe('The tab ID to scroll'),
})

// Output schema
const ScrollUpOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll succeeded'),
})

type ScrollUpInput = z.infer<typeof ScrollUpInputSchema>
type ScrollUpOutput = z.infer<typeof ScrollUpOutputSchema>

/**
 * ScrollUpAction - Scroll page up
 *
 * Scrolls the page up by one viewport height using PageUp key.
 * This approach is more reliable than the direct scrollUp API.
 *
 * Input:
 * - tabId: Tab ID to scroll
 *
 * Output:
 * - success: true if scroll succeeded
 *
 * Usage:
 * Used for scrolling back up through long pages.
 */
export class ScrollUpAction extends ActionHandler<
  ScrollUpInput,
  ScrollUpOutput
> {
  readonly inputSchema = ScrollUpInputSchema
  private browserOSAdapter = BrowserOSAdapter.getInstance()

  async execute(input: ScrollUpInput): Promise<ScrollUpOutput> {
    // Use sendKeys with PageUp instead of scrollUp API (more reliable)
    await this.browserOSAdapter.sendKeys(input.tabId, 'PageUp')

    // Add small delay for scroll to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    return { success: true }
  }
}
