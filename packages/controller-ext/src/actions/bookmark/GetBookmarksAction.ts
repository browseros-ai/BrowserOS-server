/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BookmarkAdapter} from '@/adapters/BookmarkAdapter';

// Input schema
const GetBookmarksInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Search query to filter bookmarks (optional, returns all if not provided)',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(20)
    .describe('Maximum number of results (default: 20)'),
  recent: z
    .boolean()
    .optional()
    .default(false)
    .describe('Get recent bookmarks instead of searching'),
});

// Output schema
const GetBookmarksOutputSchema = z.object({
  bookmarks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().optional(),
      dateAdded: z.number().optional(),
      parentId: z.string().optional(),
    }),
  ),
  count: z.number(),
});

type GetBookmarksInput = z.infer<typeof GetBookmarksInputSchema>;
type GetBookmarksOutput = z.infer<typeof GetBookmarksOutputSchema>;

/**
 * GetBookmarksAction - Get or search bookmarks
 *
 * Retrieves bookmarks with optional filtering.
 *
 * Input:
 * - query (optional): Search query to match title or URL
 * - limit (optional): Maximum results (default: 20)
 * - recent (optional): Get recent bookmarks instead (default: false)
 *
 * Output:
 * - bookmarks: Array of bookmark objects
 * - count: Number of bookmarks returned
 *
 * Usage:
 * - Get recent: { "recent": true }
 * - Search: { "query": "github" }
 * - Get all (limited): { "limit": 50 }
 *
 * Example:
 * {
 *   "query": "google",
 *   "limit": 10
 * }
 * // Returns: { bookmarks: [{id: "1", title: "Google", url: "https://google.com"}], count: 1 }
 */
export class GetBookmarksAction extends ActionHandler<
  GetBookmarksInput,
  GetBookmarksOutput
> {
  readonly inputSchema = GetBookmarksInputSchema;
  private bookmarkAdapter = new BookmarkAdapter();

  async execute(input: GetBookmarksInput): Promise<GetBookmarksOutput> {
    let results: chrome.bookmarks.BookmarkTreeNode[];

    if (input.recent) {
      // Get recent bookmarks
      results = await this.bookmarkAdapter.getRecentBookmarks(input.limit);
    } else if (input.query) {
      // Search bookmarks
      results = await this.bookmarkAdapter.searchBookmarks(input.query);
      results = results.slice(0, input.limit);
    } else {
      // Get recent by default
      results = await this.bookmarkAdapter.getRecentBookmarks(input.limit);
    }

    // Map to output format
    const bookmarks = results.map(b => ({
      id: b.id,
      title: b.title,
      url: b.url,
      dateAdded: b.dateAdded,
      parentId: b.parentId,
    }));

    return {
      bookmarks,
      count: bookmarks.length,
    };
  }
}
