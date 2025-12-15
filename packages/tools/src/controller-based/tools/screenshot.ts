/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';
import {parseDataUrl} from '../utils/parseDataUrl.js';

export const getScreenshot = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_screenshot',
  description: 'Capture a screenshot of the page',
  annotations: {
    category: ToolCategories.SCREENSHOTS,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to capture'),
    size: z
      .enum(['small', 'medium', 'large'])
      .optional()
      .describe(
        'Screenshot size preset (small: 512px, medium: 768px, large: 1028px)',
      ),
    showHighlights: z
      .boolean()
      .optional()
      .describe('Show element highlights in screenshot'),
    width: z.coerce
      .number()
      .optional()
      .describe('Exact width in pixels (overrides size)'),
    height: z.coerce
      .number()
      .optional()
      .describe('Exact height in pixels (overrides size)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      tabId: number;
      size?: string;
      showHighlights?: boolean;
      width?: number;
      height?: number;
      windowId?: number;
    };

    const result = await context.executeAction('captureScreenshot', params);
    const {dataUrl} = result as {dataUrl: string};

    // Parse data URL to extract MIME type and base64 data
    const {mimeType, data} = parseDataUrl(dataUrl);

    // Attach image to response
    response.attachImage({mimeType, data});
    response.appendResponseLine(`Screenshot captured from tab ${params.tabId}`);
  },
});
