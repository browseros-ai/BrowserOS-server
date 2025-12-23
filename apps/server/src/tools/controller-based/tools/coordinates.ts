/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/ToolCategories.js'
import { defineTool } from '../../types/ToolDefinition.js'
import type { Context } from '../types/Context.js'
import type { Response } from '../types/Response.js'

export const clickCoordinates = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_click_coordinates',
  description: 'Click at specific X,Y coordinates on the page',
  annotations: {
    category: ToolCategories.COORDINATES,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to click in'),
    x: z.coerce.number().describe('X coordinate'),
    y: z.coerce.number().describe('Y coordinate'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, x, y, windowId } = request.params as {
      tabId: number
      x: number
      y: number
      windowId?: number
    }

    await context.executeAction('clickCoordinates', { tabId, x, y, windowId })

    response.appendResponseLine(
      `Clicked at coordinates (${x}, ${y}) in tab ${tabId}`,
    )
  },
})

export const typeAtCoordinates = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_type_at_coordinates',
  description: 'Click at coordinates and type text',
  annotations: {
    category: ToolCategories.COORDINATES,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to type in'),
    x: z.coerce.number().describe('X coordinate'),
    y: z.coerce.number().describe('Y coordinate'),
    text: z.string().describe('Text to type'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, x, y, text, windowId } = request.params as {
      tabId: number
      x: number
      y: number
      text: string
      windowId?: number
    }

    await context.executeAction('typeAtCoordinates', {
      tabId,
      x,
      y,
      text,
      windowId,
    })

    response.appendResponseLine(
      `Clicked at (${x}, ${y}) and typed text in tab ${tabId}`,
    )
  },
})
