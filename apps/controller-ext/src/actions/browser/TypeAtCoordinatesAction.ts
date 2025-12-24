/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { getBrowserOSAdapter } from '@/adapters/BrowserOSAdapter'
import { PointerOverlay } from '@/utils/PointerOverlay'
import { ActionHandler } from '../ActionHandler'

// Input schema for typeAtCoordinates action
const TypeAtCoordinatesInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to type in'),
  x: z.number().int().nonnegative().describe('X coordinate in viewport pixels'),
  y: z.number().int().nonnegative().describe('Y coordinate in viewport pixels'),
  text: z.string().min(1).describe('Text to type at the location'),
})

type TypeAtCoordinatesInput = z.infer<typeof TypeAtCoordinatesInputSchema>

// Output confirms the typing
export interface TypeAtCoordinatesOutput {
  success: boolean
  message: string
  coordinates: {
    x: number
    y: number
  }
  textLength: number
}

/**
 * TypeAtCoordinatesAction - Type text at specific viewport coordinates
 *
 * Clicks at the specified (x, y) coordinates and types the provided text.
 * Coordinates are in pixels relative to the top-left of the visible viewport (0, 0).
 *
 * The action will:
 * 1. Click at the coordinates to focus the element
 * 2. Type the specified text
 *
 * Useful when:
 * - Input fields don't have accessible node IDs
 * - Working with complex forms or canvas-based inputs
 * - Vision-based automation (e.g., AI identifies input coordinates from screenshots)
 *
 * Example payload:
 * {
 *   "tabId": 123,
 *   "x": 500,
 *   "y": 300,
 *   "text": "Hello World"
 * }
 */
export class TypeAtCoordinatesAction extends ActionHandler<
  TypeAtCoordinatesInput,
  TypeAtCoordinatesOutput
> {
  readonly inputSchema = TypeAtCoordinatesInputSchema
  private browserOS = getBrowserOSAdapter()

  async execute(
    input: TypeAtCoordinatesInput,
  ): Promise<TypeAtCoordinatesOutput> {
    const { tabId, x, y, text } = input

    // Show pointer overlay before typing
    const textPreview =
      text.length > 20 ? `Type: ${text.substring(0, 20)}...` : `Type: ${text}`
    await PointerOverlay.showPointerAndWait(tabId, x, y, textPreview)

    await this.browserOS.typeAtCoordinates(tabId, x, y, text)

    return {
      success: true,
      message: `Successfully typed "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" at coordinates (${x}, ${y}) in tab ${tabId}`,
      coordinates: { x, y },
      textLength: text.length,
    }
  }
}
