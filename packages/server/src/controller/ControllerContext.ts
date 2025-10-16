/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {Context} from '@browseros/tools/controller-definitions';

import type {WebSocketManager} from './WebSocketManager.js';

const ACTION_TIMEOUTS: Record<string, number> = {
  getActiveTab: 10000,
  listTabs: 10000,
  switchTab: 10000,
  closeTab: 10000,
  getLoadStatus: 10000,
  scrollDown: 10000,
  scrollUp: 10000,
  scrollToNode: 10000,
  click: 10000,
  clear: 10000,
  sendKeys: 10000,
  checkBrowserOS: 10000,
  openTab: 30000,
  navigate: 30000,
  inputText: 30000,
  clickCoordinates: 30000,
  typeAtCoordinates: 30000,
  getInteractiveSnapshot: 30000,
  executeJavaScript: 30000,
  getBookmarks: 30000,
  createBookmark: 30000,
  removeBookmark: 30000,
  searchHistory: 30000,
  getRecentHistory: 30000,
  captureScreenshot: 60000,
  getSnapshot: 60000,
};

const DEFAULT_TIMEOUT = 30000;

export class ControllerContext implements Context {
  constructor(private wsManager: WebSocketManager) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    const timeout = ACTION_TIMEOUTS[action] || DEFAULT_TIMEOUT;
    return this.wsManager.sendRequest(action, payload, timeout);
  }

  isConnected(): boolean {
    return this.wsManager.isConnected();
  }
}
