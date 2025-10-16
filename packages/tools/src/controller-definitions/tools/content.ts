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
  type: 'text' | 'links';
  context: 'visible' | 'full';
  timestamp: number;
  sections: SnapshotSection[];
  processingTimeMs: number;
}

interface SnapshotSection {
  type: string;
  textResult?: {
    text: string;
    characterCount: number;
  };
  linksResult?: {
    links: LinkInfo[];
  };
}

interface LinkInfo {
  text: string;
  url: string;
  title?: string;
  attributes?: Record<string, any>;
  isExternal: boolean;
}

export const getPageContent = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_page_content',
  description: 'Extract text or links from the page. Can optionally use AI to extract structured data (TODO: add format/task params)',
  annotations: {
    category: ToolCategories.CONTENT_EXTRACTION,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to extract content from'),
    type: z.enum(['text', 'links', 'text-with-links']).describe('Type of content to extract: text, links, or text-with-links'),
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
      type: 'text' | 'links' | 'text-with-links';
      options?: {context?: 'visible' | 'full'; includeSections?: string[]};
      // TODO: Add these when implementing LLM extraction
      // format?: any;
      // task?: string;
    };

    // Determine what content to extract
    const extractText = params.type === 'text' || params.type === 'text-with-links';
    const extractLinks = params.type === 'links' || params.type === 'text-with-links';

    // Build up content similar to Extract.ts
    let hierarchicalContent = '';
    let linksContent = '';

    // Get text content if needed
    if (extractText) {
      const textSnapshot = await context.executeAction('getSnapshot', {
        tabId: params.tabId,
        type: 'text',
        options: params.options,
      });
      const snapshot = textSnapshot as Snapshot;

      // Extract text from all sections (similar to getTextSnapshotString)
      const textParts: string[] = [];
      for (const section of snapshot.sections) {
        if (section.textResult?.text) {
          textParts.push(section.textResult.text);
        }
      }
      hierarchicalContent = textParts.join('\n\n').trim();
    }

    // Get links if needed
    if (extractLinks) {
      const linksSnapshot = await context.executeAction('getSnapshot', {
        tabId: params.tabId,
        type: 'links',
        options: params.options,
      });
      const snapshot = linksSnapshot as Snapshot;

      // Format links (similar to getLinksSnapshotString)
      const linkStrings: string[] = [];
      for (const section of snapshot.sections) {
        if (section.linksResult?.links) {
          for (const link of section.linksResult.links) {
            const linkStr = link.text ? `${link.text}: ${link.url}` : link.url;
            linkStrings.push(linkStr);
          }
        }
      }
      linksContent = [...new Set(linkStrings)].join('\n').trim();
    }

    // TODO: If format and task are provided, use LLM extraction
    // if (params.format && params.task) {
    //   const contentCharLimit = 16000; // Adjust based on token limits
    //   const preparedContent =
    //     hierarchicalContent.length <= contentCharLimit
    //       ? hierarchicalContent
    //       : hierarchicalContent.substring(0, contentCharLimit) + '\n...[truncated]';
    //
    //   const userPrompt = `Task: ${params.task}
    //
    // Desired output format:
    // ${JSON.stringify(params.format, null, 2)}
    //
    // Page content:
    // URL: ${pageDetails.url}
    // Title: ${pageDetails.title}
    //
    // Content (hierarchical structure):
    // ${preparedContent}`;
    //
    //   if (extractLinks && linksContent) {
    //     userPrompt += `\n\nLinks found:\n${linksContent.substring(0, 2000)}${linksContent.length > 2000 ? '\n...[more links]' : ''}`;
    //   }
    //
    //   // Call LLM here and return structured output
    //   // For now, fall through to display raw content
    // }

    // Display extracted content (similar to Extract.ts prompt format)

    if (hierarchicalContent) {
      response.appendResponseLine('Content (hierarchical structure):');
      response.appendResponseLine(hierarchicalContent);
      response.appendResponseLine('');
      response.appendResponseLine(`(${hierarchicalContent.length} characters)`);
      response.appendResponseLine('');
    }

    if (linksContent) {
      response.appendResponseLine('Links found:');
      response.appendResponseLine(linksContent);
      response.appendResponseLine('');
      const linkCount = linksContent.split('\n').length;
      response.appendResponseLine(`(${linkCount} links)`);
      response.appendResponseLine('');
    }

    // TODO: Add placeholder note about LLM extraction
    response.appendResponseLine('='.repeat(60));
    response.appendResponseLine('NOTE: AI-powered structured data extraction coming soon.');
    response.appendResponseLine('      (Will support format and task parameters for LLM extraction)');
  },
});
