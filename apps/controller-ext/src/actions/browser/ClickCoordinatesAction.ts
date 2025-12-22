/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {getBrowserOSAdapter} from '@/adapters/BrowserOSAdapter';

// Input schema for clickCoordinates action
const ClickCoordinatesInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to click in'),
  x: z.number().int().nonnegative().describe('X coordinate in viewport pixels'),
  y: z.number().int().nonnegative().describe('Y coordinate in viewport pixels'),
});

type ClickCoordinatesInput = z.infer<typeof ClickCoordinatesInputSchema>;

// Output confirms the click
export interface ClickCoordinatesOutput {
  success: boolean;
  message: string;
  coordinates: {
    x: number;
    y: number;
  };
}

/**
 * ClickCoordinatesAction - Click at specific viewport coordinates
 *
 * Performs a click at the specified (x, y) coordinates in the viewport.
 * Coordinates are in pixels relative to the top-left of the visible viewport (0, 0).
 *
 * Useful when:
 * - Elements don't have accessible node IDs
 * - Working with canvas or interactive graphics
 * - Vision-based automation (e.g., AI identifies coordinates from screenshots)
 *
 * Example payload:
 * {
 *   "tabId": 123,
 *   "x": 500,
 *   "y": 300
 * }
 */
export class ClickCoordinatesAction extends ActionHandler<
  ClickCoordinatesInput,
  ClickCoordinatesOutput
> {
  readonly inputSchema = ClickCoordinatesInputSchema;
  private browserOS = getBrowserOSAdapter();

  async execute(input: ClickCoordinatesInput): Promise<ClickCoordinatesOutput> {
    const {tabId, x, y} = input;

    await this.browserOS.clickCoordinates(tabId, x, y);

    return {
      success: true,
      message: `Successfully clicked at coordinates (${x}, ${y}) in tab ${tabId}`,
      coordinates: {x, y},
    };
  }
}
