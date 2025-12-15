/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const navigate = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_navigate',
  description: 'Navigate to a URL in the current or specified tab',
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    url: z.string().describe('URL to navigate to (must include protocol)'),
    tabId: z.coerce
      .number()
      .optional()
      .describe('Tab ID to navigate (optional, defaults to active tab)'),
    windowId: z
      .number()
      .optional()
      .describe('Window ID (used when tabId not provided)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url: string;
      tabId?: number;
      windowId?: number;
    };

    const result = await context.executeAction('navigate', params);
    const data = result as {tabId: number; url: string; message: string};

    response.appendResponseLine(data.message);
    response.appendResponseLine(`Tab ID: ${data.tabId}`);
  },
});
