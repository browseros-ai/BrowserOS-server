/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {Context} from '@browseros/tools/controller-definitions';

import type {ControllerBridge} from './ControllerBridge.js';

const DEFAULT_TIMEOUT = 60000;

export class ControllerContext implements Context {
  constructor(private wsManager: ControllerBridge) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    return this.wsManager.sendRequest(action, payload, DEFAULT_TIMEOUT);
  }

  isConnected(): boolean {
    return this.wsManager.isConnected();
  }
}
