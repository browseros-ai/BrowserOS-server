/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {z} from 'zod';

import {ActionHandler} from '../ActionHandler';

import {getBrowserOSAdapter} from '@/adapters/BrowserOSAdapter';

// Input schema for sendKeys action
const SendKeysInputSchema = z.object({
  tabId: z.number().int().positive().describe('Tab ID to send keys to'),
  key: z
    .enum([
      'Enter',
      'Delete',
      'Backspace',
      'Tab',
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ])
    .describe('Keyboard key to send'),
});

type SendKeysInput = z.infer<typeof SendKeysInputSchema>;

// Output is just success (void result)
export interface SendKeysOutput {
  success: boolean;
  message: string;
}

/**
 * SendKeysAction - Send keyboard keys to a tab
 *
 * Sends special keyboard keys (Enter, Escape, arrows, etc.) to the specified tab.
 * Useful for navigation, form submission, closing dialogs, etc.
 *
 * Example payload:
 * {
 *   "tabId": 123,
 *   "key": "Enter"
 * }
 */
export class SendKeysAction extends ActionHandler<
  SendKeysInput,
  SendKeysOutput
> {
  readonly inputSchema = SendKeysInputSchema;
  private browserOS = getBrowserOSAdapter();

  async execute(input: SendKeysInput): Promise<SendKeysOutput> {
    const {tabId, key} = input;

    await this.browserOS.sendKeys(tabId, key as chrome.browserOS.Key);

    return {
      success: true,
      message: `Successfully sent "${key}" to tab ${tabId}`,
    };
  }
}
