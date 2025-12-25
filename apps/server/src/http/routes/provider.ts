/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import { testProviderConnection } from '../../agent/agent/gemini-vercel-sdk-adapter/testProvider.js'
import {
  type VercelAIConfig,
  VercelAIConfigSchema,
} from '../../agent/agent/gemini-vercel-sdk-adapter/types.js'
import type { Logger } from '../../common/index.js'
import { validateRequest } from '../utils/validation.js'

interface ProviderRouteDeps {
  logger: Logger
}

export function createProviderRoutes(deps: ProviderRouteDeps) {
  const { logger } = deps

  return new Hono().post(
    '/',
    validateRequest(VercelAIConfigSchema),
    async (c) => {
      const config = c.get('validatedBody') as VercelAIConfig

      logger.info('Testing provider connection', {
        provider: config.provider,
        model: config.model,
      })

      const result = await testProviderConnection(config)

      logger.info('Provider test result', {
        provider: config.provider,
        model: config.model,
        success: result.success,
        responseTime: result.responseTime,
      })

      return c.json(result, result.success ? 200 : 400)
    },
  )
}
