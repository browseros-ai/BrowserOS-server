/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'

import { ActionHandler } from '../ActionHandler'

// Input schema - no input needed
const CheckBrowserOSInputSchema = z.any()

// Output schema
const CheckBrowserOSOutputSchema = z.object({
  available: z.boolean(),
  apis: z.array(z.string()).optional(),
  error: z.string().optional(),
})

type CheckBrowserOSInput = z.infer<typeof CheckBrowserOSInputSchema>
type CheckBrowserOSOutput = z.infer<typeof CheckBrowserOSOutputSchema>

/**
 * CheckBrowserOSAction - Diagnostic action to check if chrome.browserOS is available
 *
 * This action checks:
 * 1. Whether chrome.browserOS namespace exists
 * 2. What APIs are available in the namespace
 * 3. Returns detailed diagnostic information
 */
export class CheckBrowserOSAction extends ActionHandler<
  CheckBrowserOSInput,
  CheckBrowserOSOutput
> {
  readonly inputSchema = CheckBrowserOSInputSchema

  async execute(_input: CheckBrowserOSInput): Promise<CheckBrowserOSOutput> {
    try {
      console.log('[CheckBrowserOSAction] Starting diagnostic...')
      console.log('[CheckBrowserOSAction] typeof chrome:', typeof chrome)
      console.log('[CheckBrowserOSAction] chrome exists:', chrome !== undefined)

      // Check if chrome.browserOS exists
      const browserOSExists = typeof chrome.browserOS !== 'undefined'
      console.log(
        '[CheckBrowserOSAction] typeof chrome.browserOS:',
        typeof chrome.browserOS,
      )
      console.log('[CheckBrowserOSAction] browserOSExists:', browserOSExists)

      if (!browserOSExists) {
        console.log('[CheckBrowserOSAction] chrome.browserOS is NOT available')
        return {
          available: false,
          error:
            'chrome.browserOS is undefined - not running in BrowserOS Chrome',
        }
      }

      // Get available APIs
      const apis: string[] = []
      const browserOS = chrome.browserOS as Record<string, unknown>

      for (const key in browserOS) {
        if (typeof browserOS[key] === 'function') {
          apis.push(key)
        }
      }

      console.log('[CheckBrowserOSAction] Found APIs:', apis)

      return {
        available: true,
        apis: apis.sort(),
      }
    } catch (error) {
      console.error('[CheckBrowserOSAction] Error during diagnostic:', error)
      const errorMsg =
        error instanceof Error
          ? error.message
          : error
            ? String(error)
            : 'Unknown error'
      return {
        available: false,
        error: errorMsg,
      }
    }
  }
}
