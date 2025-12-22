/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

export const getActiveTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_active_tab',
  description: 'Get information about the currently active browser tab',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {windowId?: number};
    const result = await context.executeAction('getActiveTab', params);
    const data = result as {
      tabId: number;
      url: string;
      title: string;
      windowId: number;
    };

    response.appendResponseLine(`Active Tab: ${data.title}`);
    response.appendResponseLine(`URL: ${data.url}`);
    response.appendResponseLine(`Tab ID: ${data.tabId}`);
    response.appendResponseLine(`Window ID: ${data.windowId}`);

    response.addStructuredContent('tabId', data.tabId);
    response.addStructuredContent('url', data.url);
    response.addStructuredContent('title', data.title);
    response.addStructuredContent('windowId', data.windowId);
  },
});

export const listTabs = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_list_tabs',
  description: 'Get a list of all open browser tabs',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {windowId?: number};
    const result = await context.executeAction('getTabs', params);
    const data = result as {
      tabs: Array<{
        id: number;
        url: string;
        title: string;
        windowId: number;
        active: boolean;
        index: number;
      }>;
      count: number;
    };

    response.appendResponseLine(`Found ${data.count} open tabs:`);
    response.appendResponseLine('');

    for (const tab of data.tabs) {
      const activeMarker = tab.active ? ' [ACTIVE]' : '';
      response.appendResponseLine(`[${tab.id}]${activeMarker} ${tab.title}`);
      response.appendResponseLine(`    ${tab.url}`);
      response.appendResponseLine(
        `    Window: ${tab.windowId} | Position: ${tab.index}`,
      );
    }

    response.addStructuredContent('tabs', data.tabs);
    response.addStructuredContent('count', data.count);
  },
});

export const openTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_open_tab',
  description: 'Open a new browser tab with optional URL',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    url: z
      .string()
      .optional()
      .describe('URL to open (optional, defaults to new tab page)'),
    active: z
      .boolean()
      .optional()
      .describe('Whether to make the new tab active (default: true)'),
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url?: string;
      active?: boolean;
      windowId?: number;
    };

    const result = await context.executeAction('openTab', params);
    const data = result as {tabId: number; url: string; title?: string};

    response.appendResponseLine(`Opened new tab: ${data.title || 'Untitled'}`);
    response.appendResponseLine(`URL: ${data.url}`);
    response.appendResponseLine(`Tab ID: ${data.tabId}`);
  },
});

export const closeTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_close_tab',
  description: 'Close a specific browser tab by ID',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('ID of the tab to close'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {tabId, windowId} = request.params as {
      tabId: number;
      windowId?: number;
    };

    await context.executeAction('closeTab', {tabId, windowId});

    response.appendResponseLine(`Closed tab ${tabId}`);
  },
});

export const switchTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_switch_tab',
  description: 'Switch to (activate) a specific tab',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('ID of the tab to switch to'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {tabId, windowId} = request.params as {
      tabId: number;
      windowId?: number;
    };

    const result = await context.executeAction('switchTab', {tabId, windowId});
    const data = result as {tabId: number; url: string; title: string};

    response.appendResponseLine(`Switched to tab: ${data.title}`);
    response.appendResponseLine(`URL: ${data.url}`);
  },
});

export const getLoadStatus = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_load_status',
  description: 'Check if a page has finished loading',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to check'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {tabId, windowId} = request.params as {
      tabId: number;
      windowId?: number;
    };

    const result = await context.executeAction('getPageLoadStatus', {
      tabId,
      windowId,
    });
    const data = result as {
      tabId: number;
      isResourcesLoading: boolean;
      isDOMContentLoaded: boolean;
      isPageComplete: boolean;
    };

    response.appendResponseLine(`Tab ${tabId} load status:`);
    response.appendResponseLine(
      `Resources Loading: ${data.isResourcesLoading ? 'Yes' : 'No'}`,
    );
    response.appendResponseLine(
      `DOM Content Loaded: ${data.isDOMContentLoaded ? 'Yes' : 'No'}`,
    );
    response.appendResponseLine(
      `Page Complete: ${data.isPageComplete ? 'Yes' : 'No'}`,
    );
  },
});
