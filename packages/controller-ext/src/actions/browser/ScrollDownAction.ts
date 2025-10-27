/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BrowserOSAdapter} from '@/adapters/BrowserOSAdapter';

// Input schema
const ScrollDownInputSchema = z.object({
  tabId: z.number().describe('The tab ID to scroll'),
});

// Output schema
const ScrollDownOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll succeeded'),
});

type ScrollDownInput = z.infer<typeof ScrollDownInputSchema>;
type ScrollDownOutput = z.infer<typeof ScrollDownOutputSchema>;

/**
 * ScrollDownAction - Scroll page down
 *
 * Scrolls the page down by one viewport height using PageDown key.
 * This approach is more reliable than the direct scrollDown API.
 *
 * Input:
 * - tabId: Tab ID to scroll
 *
 * Output:
 * - success: true if scroll succeeded
 *
 * Usage:
 * Used for scrolling through long pages to view content below the fold.
 */
export class ScrollDownAction extends ActionHandler<
  ScrollDownInput,
  ScrollDownOutput
> {
  readonly inputSchema = ScrollDownInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: ScrollDownInput): Promise<ScrollDownOutput> {
    // Use sendKeys with PageDown instead of scrollDown API (more reliable)
    await this.browserOSAdapter.sendKeys(input.tabId, 'PageDown');

    // Add small delay for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    return {success: true};
  }
}
