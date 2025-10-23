/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

interface Snapshot {
  items: SnapshotItem[];
}

interface SnapshotItem {
  text: string;
  type: 'heading' | 'link' | 'text';
  level?: number;
  url?: string;
}

export const getPageContent = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_page_content',
  description: 'Extract text or text with links from the page.',
  annotations: {
    category: ToolCategories.CONTENT_EXTRACTION,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to extract content from'),
    type: z.enum(['text', 'text-with-links']).describe('Type of content to extract: text or text-with-links'),
    options: z
      .object({
        context: z.enum(['visible', 'full']).optional().describe('Extract from visible viewport or full page (default: visible)'),
        includeSections: z
          .array(z.enum(['main', 'navigation', 'footer', 'header', 'article', 'aside']))
          .optional()
          .describe('Specific sections to include'),
      })
      .optional(),
    // TODO: Add LLM extraction parameters (will be added later)
    // format: z.any().optional().describe('JSON object showing desired output structure for AI extraction'),
    // task: z.string().optional().describe('Description of what data to extract using AI'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      tabId: number;
      type: 'text' | 'text-with-links';
      options?: {context?: 'visible' | 'full'; includeSections?: string[]};
    };

    try {
      const includeLinks = params.type === 'text-with-links';

      const snapshotResult = await context.executeAction('getSnapshot', {
        tabId: params.tabId,
      });
      const snapshot = snapshotResult as Snapshot;

      if (!snapshot || !snapshot.items) {
        response.appendResponseLine('No content found on the page.');
        return;
      }

      let pageContent = '';

      snapshot.items.forEach((item) => {
        if (item.type === 'heading') {
          const prefix = '#'.repeat(item.level || 1);
          pageContent += `${prefix} ${item.text}\n`;
        } else if (item.type === 'text') {
          pageContent += `${item.text}\n`;
        } else if (item.type === 'link' && includeLinks) {
          pageContent += `[${item.text}](${item.url})\n`;
        }
      });

      if (pageContent) {
        response.appendResponseLine(pageContent.trim());
        response.appendResponseLine('');
        response.appendResponseLine(`(${pageContent.length} characters)`);
      } else {
        response.appendResponseLine('No content extracted.');
      }

      response.appendResponseLine('');
      response.appendResponseLine('='.repeat(60));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Error: ${errorMessage}`);
    }
  },
});
