import { z } from 'zod';
import { ActionHandler } from '../ActionHandler';
import { BrowserOSAdapter, type Snapshot, type SnapshotOptions } from '@/adapters/BrowserOSAdapter';

// Input schema for getSnapshot action
const GetSnapshotInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to get snapshot from'),
  type: z.enum(['text', 'links']).describe('Type of snapshot to extract (text or links)'),
  options: z.object({
    context: z.enum(['visible', 'full']).optional().describe('Context to extract: visible viewport or full page'),
    includeSections: z.array(z.enum([
      'main',
      'navigation',
      'footer',
      'header',
      'article',
      'aside',
      'complementary',
      'contentinfo',
      'form',
      'search',
      'region',
      'other'
    ])).optional().describe('Specific ARIA landmark sections to include')
  }).optional().describe('Optional snapshot extraction options')
});

type GetSnapshotInput = z.infer<typeof GetSnapshotInputSchema>;

// Output is the full snapshot structure
export type GetSnapshotOutput = Snapshot;

/**
 * GetSnapshotAction - Extract text or links from a page
 *
 * Extracts structured content from the page:
 * - "text" type: Extracts readable text content organized by ARIA landmarks
 * - "links" type: Extracts all links with text and URLs
 *
 * Options:
 * - context: "visible" (viewport only) or "full" (entire page)
 * - includeSections: Array of specific ARIA landmarks to include (main, navigation, etc.)
 *
 * The snapshot is organized by sections (main, navigation, footer, etc.) for better structure.
 *
 * Example payloads:
 *
 * Get all text from visible viewport:
 * {
 *   "tabId": 123,
 *   "type": "text",
 *   "options": { "context": "visible" }
 * }
 *
 * Get links from main content only:
 * {
 *   "tabId": 123,
 *   "type": "links",
 *   "options": {
 *     "context": "full",
 *     "includeSections": ["main", "article"]
 *   }
 * }
 */
export class GetSnapshotAction extends ActionHandler<GetSnapshotInput, GetSnapshotOutput> {
  readonly inputSchema = GetSnapshotInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: GetSnapshotInput): Promise<GetSnapshotOutput> {
    const { tabId, type, options } = input;

    const snapshot = await this.browserOSAdapter.getSnapshot(
      tabId,
      type,
      options as SnapshotOptions | undefined
    );

    return snapshot;
  }
}
