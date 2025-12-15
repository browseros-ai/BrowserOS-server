/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {TabAdapter} from '@/adapters/TabAdapter';

// Input schema
const NavigateInputSchema = z.object({
  url: z.string().url().describe('URL to navigate to (must include https://)'),
  tabId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Tab ID to navigate (optional, defaults to active tab)'),
  windowId: z
    .number()
    .int()
    .optional()
    .describe('Window ID for getting active tab when tabId not provided'),
});

// Output schema
const NavigateOutputSchema = z.object({
  tabId: z.number().describe('ID of the navigated tab'),
  url: z.string().describe('URL that the tab is navigating to'),
  message: z.string().describe('Confirmation message'),
});

type NavigateInput = z.infer<typeof NavigateInputSchema>;
type NavigateOutput = z.infer<typeof NavigateOutputSchema>;

/**
 * NavigateAction - Navigate a tab to a URL
 *
 * Navigates the current tab or a specific tab to a URL.
 *
 * Input:
 * - url: URL to navigate to (must be a valid URL with protocol)
 * - tabId (optional): Specific tab to navigate (defaults to active tab)
 *
 * Output:
 * - tabId: ID of the tab that was navigated
 * - url: URL that the tab is navigating to
 * - message: Confirmation message
 *
 * Usage:
 * - Navigate active tab: { "url": "https://google.com" }
 * - Navigate specific tab: { "url": "https://google.com", "tabId": 123 }
 *
 * Example:
 * {
 *   "url": "https://www.wikipedia.org"
 * }
 * // Returns: { tabId: 123, url: "https://www.wikipedia.org", message: "Navigating to https://www.wikipedia.org" }
 */
export class NavigateAction extends ActionHandler<
  NavigateInput,
  NavigateOutput
> {
  readonly inputSchema = NavigateInputSchema;
  private tabAdapter = new TabAdapter();

  async execute(input: NavigateInput): Promise<NavigateOutput> {
    // If no tabId provided, use the active tab (in specified window if provided)
    let targetTabId = input.tabId;

    if (!targetTabId) {
      const activeTab = await this.tabAdapter.getActiveTab(input.windowId);
      targetTabId = activeTab.id!;
    }

    // Navigate the tab
    const tab = await this.tabAdapter.navigateTab(targetTabId, input.url);

    return {
      tabId: tab.id!,
      url: input.url,
      message: `Navigating to ${input.url}`,
    };
  }
}
