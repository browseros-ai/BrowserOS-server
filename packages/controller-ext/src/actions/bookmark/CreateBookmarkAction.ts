/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BookmarkAdapter} from '@/adapters/BookmarkAdapter';

// Input schema
const CreateBookmarkInputSchema = z.object({
  title: z.string().describe('Bookmark title'),
  url: z.string().url().describe('Bookmark URL'),
  parentId: z
    .string()
    .optional()
    .describe('Parent folder ID (optional, defaults to "Other Bookmarks")'),
});

// Output schema
const CreateBookmarkOutputSchema = z.object({
  id: z.string().describe('Created bookmark ID'),
  title: z.string().describe('Bookmark title'),
  url: z.string().describe('Bookmark URL'),
  dateAdded: z
    .number()
    .optional()
    .describe('Timestamp when bookmark was created'),
});

type CreateBookmarkInput = z.infer<typeof CreateBookmarkInputSchema>;
type CreateBookmarkOutput = z.infer<typeof CreateBookmarkOutputSchema>;

/**
 * CreateBookmarkAction - Create a new bookmark
 *
 * Creates a bookmark with the specified title and URL.
 *
 * Input:
 * - title: Display title for the bookmark
 * - url: Full URL to bookmark
 * - parentId (optional): Parent folder ID
 *
 * Output:
 * - id: Created bookmark ID
 * - title: Bookmark title
 * - url: Bookmark URL
 * - dateAdded: Creation timestamp
 *
 * Usage:
 * Create a bookmark in the default location (Other Bookmarks).
 *
 * Example:
 * {
 *   "title": "Google",
 *   "url": "https://www.google.com"
 * }
 * // Returns: { id: "123", title: "Google", url: "https://www.google.com", dateAdded: 1729012345678 }
 */
export class CreateBookmarkAction extends ActionHandler<
  CreateBookmarkInput,
  CreateBookmarkOutput
> {
  readonly inputSchema = CreateBookmarkInputSchema;
  private bookmarkAdapter = new BookmarkAdapter();

  async execute(input: CreateBookmarkInput): Promise<CreateBookmarkOutput> {
    const created = await this.bookmarkAdapter.createBookmark({
      title: input.title,
      url: input.url,
      parentId: input.parentId,
    });

    return {
      id: created.id,
      title: created.title,
      url: created.url || '',
      dateAdded: created.dateAdded,
    };
  }
}
