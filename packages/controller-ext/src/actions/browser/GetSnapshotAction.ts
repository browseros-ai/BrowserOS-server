/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {
  BrowserOSAdapter,
  type Snapshot,
  type SnapshotOptions,
} from '@/adapters/BrowserOSAdapter';

// Input schema for getSnapshot action
const GetSnapshotInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to get snapshot from'),
});

type GetSnapshotInput = z.infer<typeof GetSnapshotInputSchema>;

// Output is the full snapshot structure
export type GetSnapshotOutput = Snapshot;

/**
 * GetSnapshotAction - Extract page content snapshot
 *
 * Extracts structured content from the page including:
 * - Headings (with levels)
 * - Text content
 * - Links (with URLs)
 *
 * Returns items in document order with type information.
 *
 * Example payload:
 * {
 *   "tabId": 123
 * }
 */
export class GetSnapshotAction extends ActionHandler<
  GetSnapshotInput,
  GetSnapshotOutput
> {
  readonly inputSchema = GetSnapshotInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: GetSnapshotInput): Promise<GetSnapshotOutput> {
    const {tabId} = input;
    const snapshot = await this.browserOSAdapter.getSnapshot(tabId);
    return snapshot;
  }
}
