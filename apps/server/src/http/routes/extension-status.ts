/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import type { ControllerContext } from '../../controller-server/index.js'

interface ExtensionStatusDeps {
  controllerContext: ControllerContext
}

export function createExtensionStatusRoute(deps: ExtensionStatusDeps) {
  const { controllerContext } = deps

  return new Hono().get('/', (c) =>
    c.json({
      status: 'ok',
      extensionConnected: controllerContext.isConnected(),
    }),
  )
}
