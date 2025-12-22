/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {TabAdapter} from '@/adapters/TabAdapter';

// Input schema
const OpenTabInputSchema = z.object({
  url: z
    .string()
    .url()
    .optional()
    .describe('URL to open (optional, defaults to new tab page)'),
  active: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to make the new tab active'),
  windowId: z
    .number()
    .int()
    .optional()
    .describe(
      'Window ID to open the tab in. If not provided, opens in current window.',
    ),
});

// Output schema
const OpenTabOutputSchema = z.object({
  tabId: z.number().describe('ID of the newly created tab'),
  url: z.string().describe('URL of the new tab'),
  title: z.string().optional().describe('Title of the new tab'),
});

type OpenTabInput = z.infer<typeof OpenTabInputSchema>;
type OpenTabOutput = z.infer<typeof OpenTabOutputSchema>;

/**
 * OpenTabAction - Open a new browser tab
 *
 * Opens a new tab with an optional URL. If no URL is provided,
 * opens a new tab page.
 *
 * Input:
 * - url (optional): URL to open in the new tab
 * - active (optional): Whether to make the tab active (default: true)
 *
 * Output:
 * - tabId: ID of the newly created tab
 * - url: URL of the new tab
 * - title: Title of the new tab (if available)
 *
 * Usage:
 * - Open blank tab: { }
 * - Open specific URL: { "url": "https://google.com" }
 * - Open in background: { "url": "https://google.com", "active": false }
 *
 * Example:
 * {
 *   "url": "https://www.google.com",
 *   "active": true
 * }
 * // Returns: { tabId: 456, url: "https://www.google.com", title: "Google" }
 */
export class OpenTabAction extends ActionHandler<OpenTabInput, OpenTabOutput> {
  readonly inputSchema = OpenTabInputSchema;
  private tabAdapter = new TabAdapter();

  async execute(input: OpenTabInput): Promise<OpenTabOutput> {
    const tab = await this.tabAdapter.openTab(
      input.url,
      input.active ?? true,
      input.windowId,
    );

    return {
      tabId: tab.id!,
      url: tab.url || tab.pendingUrl || input.url || 'chrome://newtab/',
      title: tab.title,
    };
  }
}
