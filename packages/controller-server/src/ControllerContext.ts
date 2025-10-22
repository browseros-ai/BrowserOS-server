/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {Context} from '@browseros/tools/controller-based';

import type {ControllerBridge} from './ControllerBridge.js';

const DEFAULT_TIMEOUT = 60000;

export class ControllerContext implements Context {
  constructor(private controllerBridge: ControllerBridge) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    return this.controllerBridge.sendRequest(action, payload, DEFAULT_TIMEOUT);
  }

  isConnected(): boolean {
    return this.controllerBridge.isConnected();
  }
}
