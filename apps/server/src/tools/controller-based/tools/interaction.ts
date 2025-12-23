/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/ToolCategories.js'
import { defineTool } from '../../types/ToolDefinition.js'
import type { Context } from '../types/Context.js'
import type { Response } from '../types/Response.js'
import {
  ElementFormatter,
  type InteractiveNode,
} from '../utils/ElementFormatter.js'

const FULL_FORMATTER = new ElementFormatter(false)
const SIMPLIFIED_FORMATTER = new ElementFormatter(true)

export const getInteractiveElements = defineTool<
  z.ZodRawShape,
  Context,
  Response
>({
  name: 'browser_get_interactive_elements',
  description:
    'Get a snapshot of all interactive elements on the page (buttons, links, inputs)',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to get elements from'),
    simplified: z
      .boolean()
      .optional()
      .describe('Use simplified format (default: true)'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const {
      tabId,
      simplified = true,
      windowId,
    } = request.params as {
      tabId: number
      simplified?: boolean
      windowId?: number
    }

    const result = await context.executeAction('getInteractiveSnapshot', {
      tabId,
      windowId,
    })
    const snapshot = result as {
      snapshotId: number
      timestamp: number
      elements: InteractiveNode[]
      hierarchicalStructure?: string
      processingTimeMs: number
    }

    const formatter = simplified ? SIMPLIFIED_FORMATTER : FULL_FORMATTER

    // Separate clickable and typeable elements
    const clickableElements = snapshot.elements.filter(
      (node) => node.type === 'clickable' || node.type === 'selectable',
    )
    const typeableElements = snapshot.elements.filter(
      (node) => node.type === 'typeable',
    )

    // Format elements
    const clickableString = formatter.formatElements(clickableElements, false)
    const typeableString = formatter.formatElements(typeableElements, false)

    // Build browserStateString-style output
    response.appendResponseLine(
      `INTERACTIVE ELEMENTS (Snapshot ID: ${snapshot.snapshotId}):`,
    )
    response.appendResponseLine(
      `Processing time: ${snapshot.processingTimeMs}ms`,
    )
    response.appendResponseLine('')

    if (clickableString) {
      response.appendResponseLine('Clickable elements:')
      response.appendResponseLine(clickableString)
      response.appendResponseLine('')
    }

    if (typeableString) {
      response.appendResponseLine('Input fields:')
      response.appendResponseLine(typeableString)
      response.appendResponseLine('')
    }

    if (!clickableString && !typeableString) {
      response.appendResponseLine('No interactive elements found on this page.')
      response.appendResponseLine('')
    }

    // Optionally include hierarchical structure (if not simplified)
    if (!simplified && snapshot.hierarchicalStructure) {
      response.appendResponseLine('Page Structure:')
      response.appendResponseLine(snapshot.hierarchicalStructure)
      response.appendResponseLine('')
    }

    response.appendResponseLine('Legend:')
    response.appendResponseLine(
      '  [nodeId] - Use this number to interact with the element',
    )
    response.appendResponseLine('  <C> - Clickable element')
    response.appendResponseLine('  <T> - Typeable/input element')
    response.appendResponseLine('  (visible) - Element is in viewport')
    response.appendResponseLine(
      '  (hidden) - Element is out of viewport, may need scrolling',
    )
  },
})

export const clickElement = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_click_element',
  description:
    'Click an element by its nodeId (from browser_get_interactive_elements)',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce
      .number()
      .describe('Node ID from browser_get_interactive_elements'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId, windowId } = request.params as {
      tabId: number
      nodeId: number
      windowId?: number
    }

    await context.executeAction('click', { tabId, nodeId, windowId })

    response.appendResponseLine(`Clicked element ${nodeId} in tab ${tabId}`)
  },
})

export const typeText = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_type_text',
  description: 'Type text into an input element',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the input element'),
    text: z.string().describe('Text to type into the element'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId, text, windowId } = request.params as {
      tabId: number
      nodeId: number
      text: string
      windowId?: number
    }

    await context.executeAction('inputText', { tabId, nodeId, text, windowId })

    response.appendResponseLine(
      `Typed text into element ${nodeId} in tab ${tabId}`,
    )
  },
})

export const clearInput = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_clear_input',
  description: 'Clear text from an input element',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the input element'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId, windowId } = request.params as {
      tabId: number
      nodeId: number
      windowId?: number
    }

    await context.executeAction('clear', { tabId, nodeId, windowId })

    response.appendResponseLine(`Cleared element ${nodeId} in tab ${tabId}`)
  },
})

export const scrollToElement = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_scroll_to_element',
  description: 'Scroll to bring an element into view',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the element to scroll to'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId, windowId } = request.params as {
      tabId: number
      nodeId: number
      windowId?: number
    }

    await context.executeAction('scrollToNode', { tabId, nodeId, windowId })

    response.appendResponseLine(`Scrolled to element ${nodeId} in tab ${tabId}`)
  },
})
