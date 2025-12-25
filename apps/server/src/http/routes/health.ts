/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'

/**
 * Health check route group.
 * Simple endpoint for load balancers and monitoring.
 */
export const health = new Hono().get('/', (c) => c.json({ status: 'ok' }))
