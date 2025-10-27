/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BrowserOSAdapter} from '@/adapters/BrowserOSAdapter';

const ScrollToNodeInputSchema = z.object({
  tabId: z.number().describe('The tab ID containing the element'),
  nodeId: z.number().int().positive().describe('The nodeId to scroll to'),
});

type ScrollToNodeInput = z.infer<typeof ScrollToNodeInputSchema>;
interface ScrollToNodeOutput {
  scrolled: boolean;
}

/**
 * ScrollToNodeAction - Scroll an element into view
 *
 * Scrolls the page so that the specified element is visible in the viewport.
 * Returns whether scrolling actually occurred.
 *
 * Used by: Click/Type tools to ensure element is visible before interaction
 */
export class ScrollToNodeAction extends ActionHandler<
  ScrollToNodeInput,
  ScrollToNodeOutput
> {
  readonly inputSchema = ScrollToNodeInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: ScrollToNodeInput): Promise<ScrollToNodeOutput> {
    const scrolled = await this.browserOSAdapter.scrollToNode(
      input.tabId,
      input.nodeId,
    );
    return {scrolled};
  }
}
