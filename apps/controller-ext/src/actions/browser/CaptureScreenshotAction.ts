/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {
  BrowserOSAdapter,
  type ScreenshotSizeKey,
} from '@/adapters/BrowserOSAdapter';

// Input schema
const CaptureScreenshotInputSchema = z.object({
  tabId: z.number().describe('The tab ID to capture'),
  size: z
    .enum(['small', 'medium', 'large'])
    .optional()
    .default('medium')
    .describe('Screenshot size preset (default: medium)'),
  showHighlights: z
    .boolean()
    .optional()
    .default(true)
    .describe('Show element highlights (default: true)'),
  width: z.number().optional().describe('Exact width in pixels'),
  height: z.number().optional().describe('Exact height in pixels'),
});

// Output schema
const CaptureScreenshotOutputSchema = z.object({
  dataUrl: z.string().describe('Base64-encoded PNG data URL'),
});

type CaptureScreenshotInput = z.infer<typeof CaptureScreenshotInputSchema>;
type CaptureScreenshotOutput = z.infer<typeof CaptureScreenshotOutputSchema>;

/**
 * CaptureScreenshotAction - Capture a screenshot of the page
 *
 * Captures a screenshot with configurable size and options.
 *
 * Size Options:
 * - small (512px): Low detail, minimal tokens
 * - medium (768px): Balanced quality/tokens (default)
 * - large (1028px): High detail, maximum tokens
 *
 * Or specify exact dimensions with width/height.
 *
 * Returns:
 * - dataUrl: PNG image as base64 data URL (data:image/png;base64,...)
 *
 * Usage:
 * 1. For AI vision models: use 'medium' or 'large'
 * 2. For debugging: use 'small'
 * 3. For exact size: specify width and height
 *
 * Used by: ScreenshotTool, VisualClick, VisualType
 */
export class CaptureScreenshotAction extends ActionHandler<
  CaptureScreenshotInput,
  CaptureScreenshotOutput
> {
  readonly inputSchema = CaptureScreenshotInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(
    input: CaptureScreenshotInput,
  ): Promise<CaptureScreenshotOutput> {
    const dataUrl = await this.browserOSAdapter.captureScreenshot(
      input.tabId,
      input.size as ScreenshotSizeKey | undefined,
      input.showHighlights,
      input.width,
      input.height,
    );
    return {dataUrl};
  }
}
