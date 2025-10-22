/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {z} from 'zod';

import {ToolCategories} from '../../types/ToolCategories.js';
import {defineTool} from '../../types/ToolDefinition.js';
import type {Context} from '../types/Context.js';
import type {Response} from '../types/Response.js';

// Accessibility tree types (from chrome.browserOS)
interface AccessibilityNode {
  nodeId: number;
  role: string;
  name?: string;
  childIds?: number[];
  [key: string]: any;
}

interface AccessibilityTree {
  rootId: number;
  nodes: Record<string, AccessibilityNode>;
}

// Roles that contain meaningful content for extraction
const EXTRACTABLE_ROLES = new Set([
  'staticText',
  'heading',
  'paragraph',
  'link',
  'button',
  'textField',
  'checkBox',
  'comboBoxSelect',
  'labelText',
  'menuListOption',
  'toggleButton',
  'status',
  'alert',
  'image',
  'rootWebArea',
  'navigation',
  'main'
]);

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
      // TODO: Add these when implementing LLM extraction
      // format?: any;
      // task?: string;
    };

    // Get accessibility tree
    const tree = await context.executeAction('getAccessibilityTree', {
      tabId: params.tabId,
    }) as AccessibilityTree;

    // Extract hierarchical text using DFS stack operations
    let hierarchicalContent = '';

    if (tree && tree.nodes && tree.rootId) {
      const lines: string[] = [];
      const stack: Array<{ nodeId: number; depth: number }> = [];
      stack.push({ nodeId: tree.rootId, depth: 0 });

      while (stack.length > 0) {
        const { nodeId, depth } = stack.pop()!;

        // Get node (keys are strings)
        const node = tree.nodes[String(nodeId)];
        if (!node) continue;

        // Add text line if node has extractable role and name
        if (EXTRACTABLE_ROLES.has(node.role) && node.name) {
          const indentation = '\t'.repeat(depth);
          lines.push(`${indentation}${node.name}`);
        }

        // Always traverse children to maintain hierarchy
        // Add in reverse order for correct DFS traversal
        if (node.childIds && Array.isArray(node.childIds)) {
          for (let i = node.childIds.length - 1; i >= 0; i--) {
            stack.push({
              nodeId: node.childIds[i],
              depth: depth + 1
            });
          }
        }
      }

      hierarchicalContent = lines.join('\n');
    }

    // Get links only if extraction mode includes links
    const extractLinks = params.type === 'text-with-links';
    let linksContent = '';

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
