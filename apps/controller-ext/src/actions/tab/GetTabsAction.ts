/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {TabAdapter} from '@/adapters/TabAdapter';

// Input schema for getTabs action
const GetTabsInputSchema = z
  .object({
    currentWindowOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, return only tabs in current window'),
    windowId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('If specified, return tabs in this window only'),
    url: z
      .string()
      .optional()
      .describe(
        'URL pattern to filter tabs (supports wildcards like "*://*.google.com/*")',
      ),
    title: z.string().optional().describe('Title pattern to filter tabs'),
  })
  .describe('Optional filters for querying tabs');

type GetTabsInput = z.infer<typeof GetTabsInputSchema>;

// Tab info in output
interface TabInfo {
  id: number;
  url: string;
  title: string;
  windowId: number;
  active: boolean;
  index: number;
}

// Output with array of tabs
export interface GetTabsOutput {
  tabs: TabInfo[];
  count: number;
}

/**
 * GetTabsAction - List all available tabs
 *
 * Returns a list of all tabs (or filtered tabs) with their IDs, URLs, titles, and window info.
 * Essential for discovering which tabs exist before taking actions on them.
 *
 * Filters (all optional):
 * - currentWindowOnly: true to only get tabs in the current window
 * - windowId: Get tabs in a specific window
 * - url: URL pattern (supports wildcards like "*://*.google.com/*")
 * - title: Title pattern (supports wildcards)
 *
 * Example payloads:
 *
 * Get all tabs across all windows:
 * {}
 *
 * Get tabs in current window only:
 * { "currentWindowOnly": true }
 *
 * Get tabs in specific window:
 * { "windowId": 12345 }
 *
 * Get all Google tabs:
 * { "url": "*://*.google.com/*" }
 */
export class GetTabsAction extends ActionHandler<GetTabsInput, GetTabsOutput> {
  readonly inputSchema = GetTabsInputSchema;
  private tabAdapter = new TabAdapter();

  async execute(input: GetTabsInput): Promise<GetTabsOutput> {
    let tabs: chrome.tabs.Tab[];

    // Apply filters based on input
    if (input.windowId) {
      // Get tabs in specific window (windowId takes precedence)
      tabs = await this.tabAdapter.getTabsInWindow(input.windowId);
    } else if (input.currentWindowOnly) {
      // Get tabs in current window (windowId may be injected by agent for multi-window support)
      tabs = await this.tabAdapter.getCurrentWindowTabs();
    } else if (input.url || input.title) {
      // Use query API for URL/title filtering
      const query: chrome.tabs.QueryInfo = {};
      if (input.url) query.url = input.url;
      if (input.title) query.title = input.title;
      tabs = await this.tabAdapter.queryTabs(query);
    } else {
      // Get all tabs
      tabs = await this.tabAdapter.getAllTabs();
    }

    // Convert to simplified TabInfo format
    const tabInfos: TabInfo[] = tabs
      .filter(tab => tab.id !== undefined && tab.windowId !== undefined)
      .map(tab => ({
        id: tab.id!,
        url: tab.url || '',
        title: tab.title || '',
        windowId: tab.windowId!,
        active: tab.active || false,
        index: tab.index,
      }));

    return {
      tabs: tabInfos,
      count: tabInfos.length,
    };
  }
}
