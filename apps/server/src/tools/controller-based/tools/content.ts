/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/ToolCategories.js'
import { defineTool } from '../../types/ToolDefinition.js'
import type { Context } from '../types/Context.js'
import type { Response } from '../types/Response.js'

interface Snapshot {
  items: SnapshotItem[]
}

interface SnapshotItem {
  text: string
  type: 'heading' | 'link' | 'text'
  level?: number
  url?: string
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
    windowId: z.number().optional().describe('Window ID for routing'),
    type: z
      .enum(['text', 'text-with-links'])
      .describe('Type of content to extract: text or text-with-links'),
    page: z
      .string()
      .optional()
      .default('all')
      .describe(
        'Page number to retrieve: "all", "1", "2", etc. (default: "all")',
      ),
    contextWindow: z
      .string()
      .optional()
      .default('20k')
      .describe(
        'Context window size for pagination: "20k", "30k", "50k", "100k" (default: "20k")',
      ),
    options: z
      .object({
        context: z
          .enum(['visible', 'full'])
          .optional()
          .describe(
            'Extract from visible viewport or full page (default: visible)',
          ),
        includeSections: z
          .array(
            z.enum([
              'main',
              'navigation',
              'footer',
              'header',
              'article',
              'aside',
            ]),
          )
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
      tabId: number
      type: 'text' | 'text-with-links'
      page?: string
      contextWindow?: string
      options?: { context?: 'visible' | 'full'; includeSections?: string[] }
      windowId?: number
    }

    try {
      const includeLinks = params.type === 'text-with-links'
      const requestedPage = params.page || 'all'
      const contextWindowStr = params.contextWindow || '20k'

      // Parse context window size
      const parseContextWindow = (cw: string): number => {
        const match = cw.match(/^(\d+)k$/i)
        if (!match) return 20000 // default 20k
        return parseInt(match[1], 10) * 1000
      }

      const contextWindowSize = parseContextWindow(contextWindowStr)

      const snapshotResult = await context.executeAction('getSnapshot', {
        tabId: params.tabId,
        type: includeLinks ? 'links' : 'text',
        windowId: params.windowId,
      })
      const snapshot = snapshotResult as Snapshot

      if (!snapshot || !snapshot.items) {
        response.appendResponseLine('No content found on the page.')
        return
      }

      // Build full content
      let fullContent = ''
      snapshot.items.forEach((item) => {
        if (item.type === 'heading') {
          const prefix = '#'.repeat(item.level || 1)
          fullContent += `${prefix} ${item.text}\n`
        } else if (item.type === 'text') {
          fullContent += `${item.text}\n`
        } else if (item.type === 'link' && includeLinks) {
          fullContent += `[${item.text}](${item.url})\n`
        }
      })

      if (!fullContent) {
        response.appendResponseLine('No content extracted.')
        return
      }

      // Split content into pages
      const pages: string[] = []
      let currentPage = ''
      const lines = fullContent.split('\n')

      for (const line of lines) {
        if (
          `${currentPage + line}\n`.length > contextWindowSize &&
          currentPage.length > 0
        ) {
          pages.push(currentPage.trim())
          currentPage = ''
        }
        currentPage += `${line}\n`
      }
      if (currentPage.trim()) {
        pages.push(currentPage.trim())
      }

      const totalPages = pages.length

      // Return requested page(s)
      if (requestedPage === 'all') {
        response.appendResponseLine(
          `Total pages: ${totalPages} (${contextWindowStr} per page)`,
        )
        response.appendResponseLine('')
        response.appendResponseLine(fullContent.trim())
        response.appendResponseLine('')
        response.appendResponseLine(`(${fullContent.length} characters total)`)
      } else {
        const pageNum = parseInt(requestedPage, 10)
        if (Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
          response.appendResponseLine(
            `Error: Invalid page number "${requestedPage}". Valid pages: 1-${totalPages} or "all"`,
          )
          return
        }

        const pageIndex = pageNum - 1
        response.appendResponseLine(
          `Page ${pageNum} of ${totalPages} (${contextWindowStr} limit per page)`,
        )
        response.appendResponseLine('')
        response.appendResponseLine(pages[pageIndex])
        response.appendResponseLine('')
        response.appendResponseLine(`(${pages[pageIndex].length} characters)`)
      }

      response.appendResponseLine('')
      response.appendResponseLine('='.repeat(60))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      response.appendResponseLine(`Error: ${errorMessage}`)
    }
  },
})
