/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Context } from 'hono'
import type { Env } from '../types.js'

const LOCALHOST_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * Check if request originates from localhost.
 *
 * IMPORTANT: This checks the actual TCP connection IP (req.socket.remoteAddress equivalent)
 * which CANNOT be spoofed, unlike HTTP headers like Host or X-Forwarded-For.
 *
 * In Bun.serve, we use server.requestIP() to get the real client IP.
 *
 * @param c - Hono context with Bun server binding
 * @returns true if request is from localhost, false otherwise
 */
export function isLocalhostRequest(c: Context<Env>): boolean {
  const server = c.env.server
  const request = c.req.raw

  // 1. CHECK ACTUAL TCP CONNECTION IP (cannot be spoofed)
  const socketAddr = server.requestIP(request)
  if (!socketAddr || !LOCALHOST_ADDRESSES.has(socketAddr.address)) {
    return false
  }

  // 2. Also check Host header (defense in depth)
  const host = c.req.header('host')
  if (!host) return false
  const hostname = host.split(':')[0]
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return false

  // 3. Check referer if present (defense in depth)
  const referer = c.req.header('referer')
  if (referer) {
    try {
      const url = new URL(referer)
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}
