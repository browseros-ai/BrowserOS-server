import { z } from 'zod';
import { ActionHandler, ActionResponse } from '../ActionHandler';
import { BrowserOSAdapter } from '@/adapters/BrowserOSAdapter';

// Input schema
const ClickInputSchema = z.object({
  tabId: z.number().describe('The tab ID containing the element'),
  nodeId: z.number().int().positive().describe('The nodeId from interactive snapshot'),
});

// Output schema
const ClickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click succeeded'),
});

type ClickInput = z.infer<typeof ClickInputSchema>;
type ClickOutput = z.infer<typeof ClickOutputSchema>;

/**
 * ClickAction - Click an element by its nodeId
 *
 * This action clicks an interactive element identified by its nodeId from getInteractiveSnapshot.
 *
 * Prerequisites:
 * - Must call getInteractiveSnapshot first to get valid nodeIds
 * - NodeIds are valid only for the current page state
 * - NodeIds are invalidated on page navigation
 *
 * Usage:
 * 1. Get snapshot to find clickable elements
 * 2. Choose element by nodeId
 * 3. Call click with tabId and nodeId
 *
 * Used by: ClickTool, all automation workflows
 */
export class ClickAction extends ActionHandler<ClickInput, ClickOutput> {
  readonly inputSchema = ClickInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: ClickInput): Promise<ClickOutput> {
    await this.browserOSAdapter.click(input.tabId, input.nodeId);
    return { success: true };
  }
}
