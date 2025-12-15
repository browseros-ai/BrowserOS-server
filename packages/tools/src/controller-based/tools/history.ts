/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const searchHistory = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_search_history',
  description: 'Search browser history by text query',
  annotations: {
    category: ToolCategories.HISTORY,
    readOnlyHint: true,
  },
  schema: {
    query: z.string().describe('Search query'),
    maxResults: z.coerce
      .number()
      .optional()
      .describe('Maximum number of results to return (default: 100)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {query, maxResults, windowId} = request.params as {
      query: string;
      maxResults?: number;
      windowId?: number;
    };

    const result = await context.executeAction('searchHistory', {
      query,
      maxResults,
      windowId,
    });
    const data = result as {
      items: Array<{
        id: string;
        url?: string;
        title?: string;
        lastVisitTime?: number;
        visitCount?: number;
        typedCount?: number;
      }>;
      count: number;
    };

    response.appendResponseLine(
      `Found ${data.count} history items matching "${query}":`,
    );
    response.appendResponseLine('');

    for (const item of data.items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date';
      response.appendResponseLine(`[${item.id}] ${item.title || 'Untitled'}`);
      response.appendResponseLine(`    ${item.url || 'No URL'}`);
      response.appendResponseLine(`    Last visited: ${date}`);
      if (item.visitCount !== undefined) {
        response.appendResponseLine(`    Visit count: ${item.visitCount}`);
      }
      response.appendResponseLine('');
    }
  },
});

export const getRecentHistory = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_recent_history',
  description: 'Get most recent browser history items',
  annotations: {
    category: ToolCategories.HISTORY,
    readOnlyHint: true,
  },
  schema: {
    count: z.coerce
      .number()
      .optional()
      .describe('Number of recent items to retrieve (default: 20)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {count, windowId} = request.params as {
      count?: number;
      windowId?: number;
    };

    const result = await context.executeAction('getRecentHistory', {
      count,
      windowId,
    });
    const data = result as {
      items: Array<{
        id: string;
        url?: string;
        title?: string;
        lastVisitTime?: number;
        visitCount?: number;
      }>;
      count: number;
    };

    response.appendResponseLine(
      `Retrieved ${data.count} recent history items:`,
    );
    response.appendResponseLine('');

    for (const item of data.items) {
      const date = item.lastVisitTime
        ? new Date(item.lastVisitTime).toISOString()
        : 'Unknown date';
      response.appendResponseLine(`[${item.id}] ${item.title || 'Untitled'}`);
      response.appendResponseLine(`    ${item.url || 'No URL'}`);
      response.appendResponseLine(`    ${date}`);
      if (item.visitCount !== undefined) {
        response.appendResponseLine(`    Visits: ${item.visitCount}`);
      }
      response.appendResponseLine('');
    }
  },
});
