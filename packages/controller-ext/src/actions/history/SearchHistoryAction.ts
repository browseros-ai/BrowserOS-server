/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {HistoryAdapter} from '@/adapters/HistoryAdapter';

// Input schema
const SearchHistoryInputSchema = z.object({
  query: z.string().describe('Search query to match URL or title'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(20)
    .describe('Maximum number of results (default: 20)'),
  startTime: z
    .number()
    .optional()
    .describe('Start time in milliseconds since epoch (optional)'),
  endTime: z
    .number()
    .optional()
    .describe('End time in milliseconds since epoch (optional)'),
});

// Output schema
const SearchHistoryOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      url: z.string().optional(),
      title: z.string().optional(),
      lastVisitTime: z.number().optional(),
      visitCount: z.number().optional(),
      typedCount: z.number().optional(),
    }),
  ),
  count: z.number(),
});

type SearchHistoryInput = z.infer<typeof SearchHistoryInputSchema>;
type SearchHistoryOutput = z.infer<typeof SearchHistoryOutputSchema>;

/**
 * SearchHistoryAction - Search browser history
 *
 * Searches browser history for matching URLs and titles.
 *
 * Input:
 * - query: Search text (matches URL and title)
 * - maxResults (optional): Max results (default: 20)
 * - startTime (optional): Start time filter
 * - endTime (optional): End time filter
 *
 * Output:
 * - items: Array of history items
 * - count: Number of items returned
 *
 * Usage:
 * - Simple search: { "query": "github" }
 * - With limit: { "query": "google", "maxResults": 10 }
 * - Time range: { "query": "", "startTime": 1729000000000, "endTime": 1729100000000 }
 *
 * Example:
 * {
 *   "query": "github",
 *   "maxResults": 5
 * }
 * // Returns: { items: [{url: "https://github.com", title: "GitHub", visitCount: 42}], count: 1 }
 */
export class SearchHistoryAction extends ActionHandler<
  SearchHistoryInput,
  SearchHistoryOutput
> {
  readonly inputSchema = SearchHistoryInputSchema;
  private historyAdapter = new HistoryAdapter();

  async execute(input: SearchHistoryInput): Promise<SearchHistoryOutput> {
    const results = await this.historyAdapter.searchHistory(
      input.query,
      input.maxResults,
      input.startTime,
      input.endTime,
    );

    const items = results.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
      typedCount: item.typedCount,
    }));

    return {
      items,
      count: items.length,
    };
  }
}
