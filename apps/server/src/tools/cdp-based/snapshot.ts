/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { type Frame, Locator } from 'puppeteer-core'
import z from 'zod'

import { ToolCategories } from '../types/ToolCategories.js'
import { commonSchemas, defineTool } from '../types/ToolDefinition.js'

export const takeSnapshot = defineTool({
  name: 'take_snapshot',
  description: `Take a text snapshot of the currently selected page. The snapshot lists page elements along with a unique
identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot.`,
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  handler: async (_request, response) => {
    response.setIncludeSnapshot(true)
  },
})

export const waitFor = defineTool({
  name: 'wait_for',
  description: `Wait for the specified text to appear on the selected page.`,
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: true,
  },
  schema: {
    text: z.string().describe('Text to appear on the page'),
    ...commonSchemas.timeout,
  },
  handler: async (request, response, context) => {
    const page = context.getSelectedPage()
    const frames = page.frames()

    const locator = Locator.race(
      frames.flatMap((frame: Frame) => [
        frame.locator(`aria/${request.params.text}`),
        frame.locator(`text/${request.params.text}`),
      ]),
    )

    if (request.params.timeout) {
      locator.setTimeout(request.params.timeout)
    }

    await locator.wait()

    response.appendResponseLine(
      `Element with text "${request.params.text}" found.`,
    )

    response.setIncludeSnapshot(true)
  },
})
