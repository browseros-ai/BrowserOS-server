/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {BrowserOSAdapter} from '@/adapters/BrowserOSAdapter';

// Input schema
const ExecuteJavaScriptInputSchema = z.object({
  tabId: z.number().describe('The tab ID to execute code in'),
  code: z.string().describe('JavaScript code to execute'),
});

// Output schema
const ExecuteJavaScriptOutputSchema = z.object({
  result: z.any().describe('The result of the code execution'),
});

type ExecuteJavaScriptInput = z.infer<typeof ExecuteJavaScriptInputSchema>;
type ExecuteJavaScriptOutput = z.infer<typeof ExecuteJavaScriptOutputSchema>;

/**
 * ExecuteJavaScriptAction - Execute JavaScript code in page context
 *
 * Executes arbitrary JavaScript code in the page and returns the result.
 *
 * Input:
 * - tabId: Tab ID to execute code in
 * - code: JavaScript code as string
 *
 * Output:
 * - result: The return value of the executed code
 *
 * Usage:
 * - Extract data from page: "document.title"
 * - Manipulate DOM: "document.body.style.background = 'red'"
 * - Get element values: "document.querySelector('#email').value"
 *
 * Example:
 * {
 *   "tabId": 123,
 *   "code": "document.title"
 * }
 * // Returns: { result: "Google" }
 */
export class ExecuteJavaScriptAction extends ActionHandler<
  ExecuteJavaScriptInput,
  ExecuteJavaScriptOutput
> {
  readonly inputSchema = ExecuteJavaScriptInputSchema;
  private browserOSAdapter = BrowserOSAdapter.getInstance();

  async execute(
    input: ExecuteJavaScriptInput,
  ): Promise<ExecuteJavaScriptOutput> {
    const result = await this.browserOSAdapter.executeJavaScript(
      input.tabId,
      input.code,
    );
    return {result};
  }
}
