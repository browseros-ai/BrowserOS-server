/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {TabAdapter} from '@/adapters/TabAdapter';

/**
 * GetActiveTabAction - Returns information about the currently active tab
 *
 * Input: None (void)
 * Output: { tabId, url, title, windowId }
 *
 * Use Case:
 * - Agent needs to know which tab user is currently viewing
 * - Required for most automation actions (need to know target tab)
 *
 * Example Request:
 * {
 *   "id": "req-123",
 *   "action": "getActiveTab",
 *   "payload": {}
 * }
 *
 * Example Response:
 * {
 *   "id": "req-123",
 *   "ok": true,
 *   "data": {
 *     "tabId": 5,
 *     "url": "https://google.com",
 *     "title": "Google",
 *     "windowId": 1
 *   }
 * }
 */

// Input schema - accepts optional windowId for multi-window support
const GetActiveTabInputSchema = z
  .object({
    windowId: z
      .number()
      .int()
      .optional()
      .describe(
        'Window ID to get active tab from. If not provided, uses current window.',
      ),
  })
  .passthrough();

// Output type
export interface GetActiveTabOutput {
  tabId: number;
  url: string;
  title: string;
  windowId: number;
}

type GetActiveTabInput = z.infer<typeof GetActiveTabInputSchema>;

export class GetActiveTabAction extends ActionHandler<
  GetActiveTabInput,
  GetActiveTabOutput
> {
  readonly inputSchema = GetActiveTabInputSchema;
  private tabAdapter = new TabAdapter();

  /**
   * Execute getActiveTab action
   *
   * Logic:
   * 1. Get active tab via TabAdapter (using windowId if provided)
   * 2. Extract relevant fields
   * 3. Return typed result
   *
   * @param input - Optional windowId to specify which window
   * @returns Active tab information
   * @throws Error if no active tab found
   */
  async execute(input: GetActiveTabInput): Promise<GetActiveTabOutput> {
    // Get active tab from Chrome (use windowId if provided)
    const tab = await this.tabAdapter.getActiveTab(input.windowId);

    // Validate required fields exist
    if (tab.id === undefined) {
      throw new Error('Active tab has no ID');
    }

    if (tab.windowId === undefined) {
      throw new Error('Active tab has no window ID');
    }

    // Return typed result
    return {
      tabId: tab.id,
      url: tab.url || '',
      title: tab.title || '',
      windowId: tab.windowId,
    };
  }
}
