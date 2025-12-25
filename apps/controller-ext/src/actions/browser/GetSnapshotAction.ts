/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { BrowserOSAdapter, type Snapshot } from '@/adapters/BrowserOSAdapter'
import { logger } from '@/utils/logger'
import { ActionHandler } from '../ActionHandler'

// Input schema for getSnapshot action
const GetSnapshotInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to get snapshot from'),
  type: z
    .enum(['text', 'links'])
    .default('text')
    .describe('Type of snapshot: text or links'),
  options: z
    .object({
      context: z.enum(['visible', 'full']).optional(),
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
        .optional(),
    })
    .optional()
    .describe('Optional snapshot configuration'),
})

type GetSnapshotInput = z.infer<typeof GetSnapshotInputSchema>

// Output is the full snapshot structure
export type GetSnapshotOutput = Snapshot

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
 *   "tabId": 123,
 *   "type": "text"
 * }
 */
export class GetSnapshotAction extends ActionHandler<
  GetSnapshotInput,
  GetSnapshotOutput
> {
  readonly inputSchema = GetSnapshotInputSchema
  private browserOSAdapter = BrowserOSAdapter.getInstance()

  async execute(input: GetSnapshotInput): Promise<GetSnapshotOutput> {
    const { tabId, type } = input
    logger.info(
      `[GetSnapshotAction] Getting snapshot for tab ${tabId} with type ${type}`,
    )
    const snapshot = await this.browserOSAdapter.getSnapshot(tabId, type)
    return snapshot
  }
}
