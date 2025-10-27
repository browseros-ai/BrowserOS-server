/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BookmarkAdapter} from '@/adapters/BookmarkAdapter';

// Input schema
const RemoveBookmarkInputSchema = z.object({
  id: z.string().describe('Bookmark ID to remove'),
});

// Output schema
const RemoveBookmarkOutputSchema = z.object({
  success: z
    .boolean()
    .describe('Whether the bookmark was successfully removed'),
  message: z.string().describe('Confirmation message'),
});

type RemoveBookmarkInput = z.infer<typeof RemoveBookmarkInputSchema>;
type RemoveBookmarkOutput = z.infer<typeof RemoveBookmarkOutputSchema>;

/**
 * RemoveBookmarkAction - Remove a bookmark
 *
 * Deletes a bookmark by its ID.
 *
 * Input:
 * - id: Bookmark ID to remove
 *
 * Output:
 * - success: true if removed
 * - message: Confirmation message
 *
 * Usage:
 * Get the bookmark ID from getBookmarks first, then remove it.
 *
 * Example:
 * {
 *   "id": "123"
 * }
 * // Returns: { success: true, message: "Removed bookmark 123" }
 */
export class RemoveBookmarkAction extends ActionHandler<
  RemoveBookmarkInput,
  RemoveBookmarkOutput
> {
  readonly inputSchema = RemoveBookmarkInputSchema;
  private bookmarkAdapter = new BookmarkAdapter();

  async execute(input: RemoveBookmarkInput): Promise<RemoveBookmarkOutput> {
    await this.bookmarkAdapter.removeBookmark(input.id);

    return {
      success: true,
      message: `Removed bookmark ${input.id}`,
    };
  }
}
