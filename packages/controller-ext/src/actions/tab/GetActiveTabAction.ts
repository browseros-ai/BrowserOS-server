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

// Input schema - no input needed (accepts any payload, will be ignored)
const GetActiveTabInputSchema = z.any();

// Output type
export interface GetActiveTabOutput {
  tabId: number;
  url: string;
  title: string;
  windowId: number;
}

export class GetActiveTabAction extends ActionHandler<any, GetActiveTabOutput> {
  readonly inputSchema = GetActiveTabInputSchema;
  private tabAdapter = new TabAdapter();

  /**
   * Execute getActiveTab action
   *
   * Logic:
   * 1. Get active tab via TabAdapter
   * 2. Extract relevant fields
   * 3. Return typed result
   *
   * @param _input - Ignored (no input needed)
   * @returns Active tab information
   * @throws Error if no active tab found
   */
  async execute(_input: any): Promise<GetActiveTabOutput> {
    // Get active tab from Chrome
    const tab = await this.tabAdapter.getActiveTab();

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
