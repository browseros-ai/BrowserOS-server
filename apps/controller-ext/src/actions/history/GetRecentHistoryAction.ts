/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {HistoryAdapter} from '@/adapters/HistoryAdapter';

// Input schema
const GetRecentHistoryInputSchema = z.object({
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(20)
    .describe('Maximum number of results (default: 20)'),
  hoursBack: z
    .number()
    .int()
    .positive()
    .optional()
    .default(24)
    .describe('How many hours back to search (default: 24)'),
});

// Output schema
const GetRecentHistoryOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      url: z.string().optional(),
      title: z.string().optional(),
      lastVisitTime: z.number().optional(),
      visitCount: z.number().optional(),
    }),
  ),
  count: z.number(),
});

type GetRecentHistoryInput = z.infer<typeof GetRecentHistoryInputSchema>;
type GetRecentHistoryOutput = z.infer<typeof GetRecentHistoryOutputSchema>;

/**
 * GetRecentHistoryAction - Get recent browser history
 *
 * Retrieves the most recent browser history items.
 *
 * Input:
 * - maxResults (optional): Max results (default: 20)
 * - hoursBack (optional): Time range in hours (default: 24)
 *
 * Output:
 * - items: Array of recent history items
 * - count: Number of items returned
 *
 * Usage:
 * - Last 24 hours: { }
 * - Last hour: { "hoursBack": 1 }
 * - Last week: { "hoursBack": 168, "maxResults": 50 }
 *
 * Example:
 * {
 *   "maxResults": 10,
 *   "hoursBack": 1
 * }
 * // Returns: { items: [{url: "https://google.com", title: "Google", lastVisitTime: 1729012345678}], count: 10 }
 */
export class GetRecentHistoryAction extends ActionHandler<
  GetRecentHistoryInput,
  GetRecentHistoryOutput
> {
  readonly inputSchema = GetRecentHistoryInputSchema;
  private historyAdapter = new HistoryAdapter();

  async execute(input: GetRecentHistoryInput): Promise<GetRecentHistoryOutput> {
    const results = await this.historyAdapter.getRecentHistory(
      input.maxResults,
      input.hoursBack,
    );

    const items = results.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
    }));

    return {
      items,
      count: items.length,
    };
  }
}
