/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Context, Next } from 'hono'
import type { z } from 'zod'
import { ValidationError } from '../../agent/errors.js'
import { logger } from '../../common/index.js'

interface ValidationVariables {
  validatedBody: unknown
}

/**
 * Middleware factory for request body validation using Zod schemas.
 *
 * @param schema - Zod schema to validate request body against
 * @returns Hono middleware that validates and sets validatedBody variable
 *
 * @example
 * ```typescript
 * app.post('/chat', validateRequest(ChatRequestSchema), async (c) => {
 *   const request = c.get('validatedBody') as ChatRequest
 *   // ... handle request
 * })
 * ```
 */
export function validateRequest<T>(schema: z.ZodType<T>) {
  return async (c: Context<{ Variables: ValidationVariables }>, next: Next) => {
    try {
      const body = await c.req.json()
      const validated = schema.parse(body)
      c.set('validatedBody', validated)
      await next()
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodError = err as { issues: unknown }
        logger.warn('Request validation failed', { issues: zodError.issues })
        throw new ValidationError('Request validation failed', zodError.issues)
      }
      throw err
    }
  }
}
