/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { cors } from 'hono/cors'

type CorsOptions = Parameters<typeof cors>[0]

/**
 * Default CORS configuration for the HTTP server.
 * Permissive since MCP endpoints are protected by localhost check.
 */
export const defaultCorsConfig: CorsOptions = {
  origin: (origin: string | undefined) => origin || '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
}
