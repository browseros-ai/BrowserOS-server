/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const getBookmarks = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_bookmarks',
  description: 'Get all bookmarks from the browser',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: true,
  },
  schema: {
    folderId: z
      .string()
      .optional()
      .describe('Optional folder ID to get bookmarks from (omit for all)'),
  },
  handler: async (request, response, context) => {
    const {folderId} = request.params as {folderId?: string};

    const result = await context.executeAction('getBookmarks', {folderId});
    const data = result as {
      bookmarks: Array<{
        id: string;
        title: string;
        url?: string;
        parentId?: string;
      }>;
    };

    response.appendResponseLine(`Found ${data.bookmarks.length} bookmarks:`);
    response.appendResponseLine('');

    for (const bookmark of data.bookmarks) {
      if (bookmark.url) {
        response.appendResponseLine(`[${bookmark.id}] ${bookmark.title}`);
        response.appendResponseLine(`    ${bookmark.url}`);
      } else {
        response.appendResponseLine(
          `[${bookmark.id}] 📁 ${bookmark.title} (folder)`,
        );
      }
    }
  },
});

export const createBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_create_bookmark',
  description: 'Create a new bookmark',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    title: z.string().describe('Bookmark title'),
    url: z.string().describe('URL to bookmark'),
    parentId: z.string().optional().describe('Optional parent folder ID'),
  },
  handler: async (request, response, context) => {
    const {title, url, parentId} = request.params as {
      title: string;
      url: string;
      parentId?: string;
    };

    const result = await context.executeAction('createBookmark', {
      title,
      url,
      parentId,
    });
    const data = result as {id: string; title: string; url: string};

    response.appendResponseLine(`Created bookmark: ${data.title}`);
    response.appendResponseLine(`URL: ${data.url}`);
    response.appendResponseLine(`ID: ${data.id}`);
  },
});

export const removeBookmark = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_remove_bookmark',
  description: 'Remove a bookmark by ID',
  annotations: {
    category: ToolCategories.BOOKMARKS,
    readOnlyHint: false,
  },
  schema: {
    bookmarkId: z.string().describe('Bookmark ID to remove'),
  },
  handler: async (request, response, context) => {
    const {bookmarkId} = request.params as {bookmarkId: string};

    await context.executeAction('removeBookmark', {id: bookmarkId});

    response.appendResponseLine(`Removed bookmark ${bookmarkId}`);
  },
});
