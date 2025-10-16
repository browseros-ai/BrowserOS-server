/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const scrollDown = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_scroll_down',
  description: 'Scroll the page down by one viewport height',
  annotations: {
    category: ToolCategories.SCROLLING,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to scroll'),
  },
  handler: async (request, response, context) => {
    const {tabId} = request.params as {tabId: number};

    await context.executeAction('scrollDown', {tabId});

    response.appendResponseLine(`Scrolled down in tab ${tabId}`);
  },
});

export const scrollUp = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_scroll_up',
  description: 'Scroll the page up by one viewport height',
  annotations: {
    category: ToolCategories.SCROLLING,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to scroll'),
  },
  handler: async (request, response, context) => {
    const {tabId} = request.params as {tabId: number};

    await context.executeAction('scrollUp', {tabId});

    response.appendResponseLine(`Scrolled up in tab ${tabId}`);
  },
});
