/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import { KlavisClient } from '../../agent/klavis/KlavisClient.js'
import { OAUTH_MCP_SERVERS } from '../../agent/klavis/OAuthMcpServers.js'
import type { Logger } from '../../common/index.js'

interface KlavisRouteDeps {
  browserosId: string
  logger: Logger
}

export function createKlavisRoutes(deps: KlavisRouteDeps) {
  const { browserosId, logger } = deps
  const klavisClient = new KlavisClient()

  const klavis = new Hono()

  klavis.get('/servers', (c) => {
    return c.json({
      servers: OAUTH_MCP_SERVERS,
      count: OAUTH_MCP_SERVERS.length,
    })
  })

  klavis.get('/oauth-urls', async (c) => {
    if (!browserosId) {
      return c.json({ error: 'browserosId not configured' }, 500)
    }

    try {
      const serverNames = OAUTH_MCP_SERVERS.map((s) => s.name)
      const response = await klavisClient.createStrata(browserosId, serverNames)

      logger.info('Generated OAuth URLs', {
        browserosId: browserosId.slice(0, 12),
        serverCount: serverNames.length,
      })

      return c.json({
        oauthUrls: response.oauthUrls || {},
        servers: serverNames,
      })
    } catch (error) {
      logger.error('Error getting OAuth URLs', {
        browserosId: browserosId?.slice(0, 12),
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: 'Failed to get OAuth URLs' }, 500)
    }
  })

  klavis.get('/user-integrations', async (c) => {
    if (!browserosId) {
      return c.json({ error: 'browserosId not configured' }, 500)
    }

    try {
      const integrations = await klavisClient.getUserIntegrations(browserosId)
      logger.info('Fetched user integrations', {
        browserosId: browserosId.slice(0, 12),
        count: integrations.length,
      })
      return c.json({ integrations, count: integrations.length })
    } catch (error) {
      logger.error('Error fetching user integrations', {
        browserosId: browserosId?.slice(0, 12),
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: 'Failed to fetch user integrations' }, 500)
    }
  })

  klavis.post('/servers/add', async (c) => {
    if (!browserosId) {
      return c.json({ error: 'browserosId not configured' }, 500)
    }

    const body = await c.req.json()
    const serverName = body.serverName as string

    if (!serverName) {
      return c.json({ error: 'serverName is required' }, 400)
    }

    const validServer = OAUTH_MCP_SERVERS.find((s) => s.name === serverName)
    if (!validServer) {
      return c.json({ error: `Invalid server: ${serverName}` }, 400)
    }

    logger.info('Adding server to strata', { serverName })

    const result = await klavisClient.createStrata(browserosId, [serverName])

    return c.json({
      success: true,
      serverName,
      strataId: result.strataId,
      addedServers: result.addedServers,
      oauthUrl: result.oauthUrls?.[serverName],
    })
  })

  klavis.delete('/servers/remove', async (c) => {
    if (!browserosId) {
      return c.json({ error: 'browserosId not configured' }, 500)
    }

    const body = await c.req.json()
    const serverName = body.serverName as string

    if (!serverName) {
      return c.json({ error: 'serverName is required' }, 400)
    }

    const validServer = OAUTH_MCP_SERVERS.find((s) => s.name === serverName)
    if (!validServer) {
      return c.json({ error: `Invalid server: ${serverName}` }, 400)
    }

    logger.info('Removing server from strata', { serverName })

    await klavisClient.removeServer(browserosId, serverName)

    return c.json({
      success: true,
      serverName,
    })
  })

  return klavis
}
