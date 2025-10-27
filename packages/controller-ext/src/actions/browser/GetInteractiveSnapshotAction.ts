/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler, ActionResponse} from '../ActionHandler';

import {BrowserOSAdapter} from '@/adapters/BrowserOSAdapter';
import type {
  InteractiveSnapshot,
  InteractiveSnapshotOptions,
} from '@/adapters/BrowserOSAdapter';

// Input schema
const GetInteractiveSnapshotInputSchema = z.object({
  tabId: z.number().describe('The tab ID to get snapshot from'),
  options: z
    .object({
      includeHidden: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include hidden elements (default: false)'),
    })
    .optional()
    .describe('Optional snapshot options'),
});

type GetInteractiveSnapshotInput = z.infer<
  typeof GetInteractiveSnapshotInputSchema
>;

/**
 * GetInteractiveSnapshotAction - Get interactive elements from the page
 *
 * This is THE MOST CRITICAL action - it returns all interactive elements
 * with their nodeIds, which are needed by click, inputText, clear, and scrollToNode actions.
 *
 * Returns:
 * - elements: Array of interactive nodes with nodeIds
 * - hierarchicalStructure: String representation of page structure
 *
 * Each element contains:
 * - nodeId: Sequential integer ID (1, 2, 3...)
 * - type: 'clickable' | 'typeable' | 'selectable'
 * - name: Element text/label
 * - attributes: Element properties (html-tag, role, etc.)
 * - rect: Bounding box coordinates
 */
export class GetInteractiveSnapshotAction extends ActionHandler<
  GetInteractiveSnapshotInput,
  InteractiveSnapshot
> {
  readonly inputSchema = GetInteractiveSnapshotInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(
    input: GetInteractiveSnapshotInput,
  ): Promise<InteractiveSnapshot> {
    return await this.browserOSAdapter.getInteractiveSnapshot(
      input.tabId,
      input.options as InteractiveSnapshotOptions | undefined,
    );
  }
}
