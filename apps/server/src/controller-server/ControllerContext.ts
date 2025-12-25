/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { TIMEOUTS } from '@browseros/shared/timeouts'

import type { Context } from '../tools/controller-based/index.js'

import type { ControllerBridge } from './ControllerBridge.js'

export class ControllerContext implements Context {
  constructor(private controllerBridge: ControllerBridge) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    return this.controllerBridge.sendRequest(
      action,
      payload,
      TIMEOUTS.CONTROLLER_DEFAULT,
    )
  }

  isConnected(): boolean {
    return this.controllerBridge.isConnected()
  }
}
