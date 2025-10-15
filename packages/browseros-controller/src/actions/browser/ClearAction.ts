import { z } from 'zod';
import { ActionHandler } from '../ActionHandler';
import { BrowserOSAdapter } from '@/adapters/BrowserOSAdapter';

const ClearInputSchema = z.object({
  tabId: z.number().describe('The tab ID containing the element'),
  nodeId: z.number().int().positive().describe('The nodeId from interactive snapshot'),
});

type ClearInput = z.infer<typeof ClearInputSchema>;
type ClearOutput = { success: boolean };

/**
 * ClearAction - Clear text from an input element
 *
 * Clears all text from an input field or textarea.
 * Used before inputText or to reset form fields.
 */
export class ClearAction extends ActionHandler<ClearInput, ClearOutput> {
  readonly inputSchema = ClearInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(input: ClearInput): Promise<ClearOutput> {
    await this.browserOSAdapter.clear(input.tabId, input.nodeId);
    return { success: true };
  }
}
