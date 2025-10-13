/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {ToolCategories} from '../types/ToolCategories.js';
import {defineTool} from '../types/ToolDefinition.js';

export const consoleTool = defineTool({
  name: 'list_console_messages',
  description: 'List all console messages for the currently selected page',
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  handler: async (_request, response) => {
    response.setIncludeConsoleData(true);
  },
});
