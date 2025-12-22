/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const executeJavaScript = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_execute_javascript',
  description:
    'Execute arbitrary JavaScript code in the page context. Use this tool sparingly.',
  annotations: {
    category: ToolCategories.ADVANCED,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to execute code in'),
    code: z.string().describe('JavaScript code to execute'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {tabId, code, windowId} = request.params as {
      tabId: number;
      code: string;
      windowId?: number;
    };

    const result = await context.executeAction('executeJavaScript', {
      tabId,
      code,
      windowId,
    });
    const data = result as {result: any};

    response.appendResponseLine(`JavaScript executed in tab ${tabId}`);
    response.appendResponseLine(
      `Result: ${JSON.stringify(data.result, null, 2)}`,
    );
  },
});

export const sendKeys = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_send_keys',
  description: 'Send keyboard keys to the active tab',
  annotations: {
    category: ToolCategories.ADVANCED,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to send keys to'),
    key: z
      .enum([
        'Enter',
        'Delete',
        'Backspace',
        'Tab',
        'Escape',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ])
      .describe('Keyboard key to send'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {tabId, key, windowId} = request.params as {
      tabId: number;
      key: string;
      windowId?: number;
    };

    const result = await context.executeAction('sendKeys', {
      tabId,
      key,
      windowId,
    });
    const data = result as {success: boolean; message: string};

    response.appendResponseLine(data.message);
  },
});

export const checkAvailability = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_check_availability',
  description: 'Check if the BrowserOS extension APIs are available',
  annotations: {
    category: ToolCategories.ADVANCED,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {windowId} = request.params as {windowId?: number};
    const result = await context.executeAction('checkBrowserOS', {windowId});
    const data = result as {
      available: boolean;
      apis?: string[];
      error?: string;
    };

    response.appendResponseLine(
      `BrowserOS APIs available: ${data.available ? 'Yes' : 'No'}`,
    );

    if (data.error) {
      response.appendResponseLine(`Error: ${data.error}`);
    } else if (data.apis && data.apis.length > 0) {
      response.appendResponseLine(`Total APIs: ${data.apis.length}`);
      response.appendResponseLine('');
      response.appendResponseLine('Available APIs:');
      for (const api of data.apis) {
        response.appendResponseLine(`  - ${api}`);
      }
    } else {
      response.appendResponseLine('No API information available');
    }
  },
});
