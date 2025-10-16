
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { ActionRegistry } from '@/actions/ActionRegistry';
import { CreateBookmarkAction } from '@/actions/bookmark/CreateBookmarkAction';
import { GetBookmarksAction } from '@/actions/bookmark/GetBookmarksAction';
import { RemoveBookmarkAction } from '@/actions/bookmark/RemoveBookmarkAction';
import { CaptureScreenshotAction } from '@/actions/browser/CaptureScreenshotAction';
import { ClearAction } from '@/actions/browser/ClearAction';
import { ClickAction } from '@/actions/browser/ClickAction';
import { ClickCoordinatesAction } from '@/actions/browser/ClickCoordinatesAction';
import { GetInteractiveSnapshotAction } from '@/actions/browser/GetInteractiveSnapshotAction';
import { GetPageLoadStatusAction } from '@/actions/browser/GetPageLoadStatusAction';
import { SendKeysAction } from '@/actions/browser/SendKeysAction';
import { GetSnapshotAction } from '@/actions/browser/GetSnapshotAction';
import { TypeAtCoordinatesAction } from '@/actions/browser/TypeAtCoordinatesAction';
import { InputTextAction } from '@/actions/browser/InputTextAction';
import { ScrollToNodeAction } from '@/actions/browser/ScrollToNodeAction';
import { ScrollDownAction } from '@/actions/browser/ScrollDownAction';
import { ScrollUpAction } from '@/actions/browser/ScrollUpAction';
import { ExecuteJavaScriptAction } from '@/actions/browser/ExecuteJavaScriptAction';
import { CheckBrowserOSAction } from '@/actions/diagnostics/CheckBrowserOSAction';
import { GetRecentHistoryAction } from '@/actions/history/GetRecentHistoryAction';
import { SearchHistoryAction } from '@/actions/history/SearchHistoryAction';
import { CloseTabAction } from '@/actions/tab/CloseTabAction';
import { GetActiveTabAction } from '@/actions/tab/GetActiveTabAction';
import { GetTabsAction } from '@/actions/tab/GetTabsAction';
import { NavigateAction } from '@/actions/tab/NavigateAction';
import { OpenTabAction } from '@/actions/tab/OpenTabAction';
import { SwitchTabAction } from '@/actions/tab/SwitchTabAction';
import { CONCURRENCY_CONFIG } from '@/config/constants';
import type { ProtocolRequest, ProtocolResponse} from '@/protocol/types';
import { ConnectionStatus } from '@/protocol/types';
import { ConcurrencyLimiter } from '@/utils/ConcurrencyLimiter';
import { getWebSocketPort } from '@/utils/ConfigHelper';
import { logger } from '@/utils/Logger';
import { RequestTracker } from '@/utils/RequestTracker';
import { RequestValidator } from '@/utils/RequestValidator';
import { ResponseQueue } from '@/utils/ResponseQueue';
import { WebSocketClient } from '@/websocket/WebSocketClient';

/**
 * BrowserOS Controller
 *
 * Main controller class that orchestrates all components.
 * Message flow: WebSocket → Validator → Tracker → Limiter → Action → Response/Queue → WebSocket
 */
class BrowserOSController {
  private wsClient: WebSocketClient;
  private requestTracker: RequestTracker;
  private concurrencyLimiter: ConcurrencyLimiter;
  private requestValidator: RequestValidator;
  private responseQueue: ResponseQueue;
  private actionRegistry: ActionRegistry;

  constructor(port: number) {
    logger.info('Initializing BrowserOS Controller...');

    // Initialize all components
    this.requestTracker = new RequestTracker();
    this.concurrencyLimiter = new ConcurrencyLimiter(
      CONCURRENCY_CONFIG.maxConcurrent,
      CONCURRENCY_CONFIG.maxQueueSize
    );
    this.requestValidator = new RequestValidator();
    this.responseQueue = new ResponseQueue();
    this.wsClient = new WebSocketClient(port);
    this.actionRegistry = new ActionRegistry();

    // Register actions
    this._registerActions();

    // Wire up event handlers
    this._setupWebSocketHandlers();
  }

  private _registerActions(): void {
    logger.info('Registering actions...');

    // Diagnostic actions
    this.actionRegistry.register('checkBrowserOS', new CheckBrowserOSAction());

    // Tab actions
    this.actionRegistry.register('getActiveTab', new GetActiveTabAction());
    this.actionRegistry.register('getTabs', new GetTabsAction());
    this.actionRegistry.register('openTab', new OpenTabAction());
    this.actionRegistry.register('closeTab', new CloseTabAction());
    this.actionRegistry.register('switchTab', new SwitchTabAction());
    this.actionRegistry.register('navigate', new NavigateAction());

    // Bookmark actions
    this.actionRegistry.register('getBookmarks', new GetBookmarksAction());
    this.actionRegistry.register('createBookmark', new CreateBookmarkAction());
    this.actionRegistry.register('removeBookmark', new RemoveBookmarkAction());

    // History actions
    this.actionRegistry.register('searchHistory', new SearchHistoryAction());
    this.actionRegistry.register('getRecentHistory', new GetRecentHistoryAction());

    // Browser actions - Interactive Elements (NEW!)
    this.actionRegistry.register('getInteractiveSnapshot', new GetInteractiveSnapshotAction());
    this.actionRegistry.register('click', new ClickAction());
    this.actionRegistry.register('inputText', new InputTextAction());
    this.actionRegistry.register('clear', new ClearAction());
    this.actionRegistry.register('scrollToNode', new ScrollToNodeAction());

    // Browser actions - Visual & Screenshots
    this.actionRegistry.register('captureScreenshot', new CaptureScreenshotAction());

    // Browser actions - Scrolling
    this.actionRegistry.register('scrollDown', new ScrollDownAction());
    this.actionRegistry.register('scrollUp', new ScrollUpAction());

    // Browser actions - Advanced
    this.actionRegistry.register('executeJavaScript', new ExecuteJavaScriptAction());
    this.actionRegistry.register('sendKeys', new SendKeysAction());
    this.actionRegistry.register('getPageLoadStatus', new GetPageLoadStatusAction());
    this.actionRegistry.register('getSnapshot', new GetSnapshotAction());
    this.actionRegistry.register('clickCoordinates', new ClickCoordinatesAction());
    this.actionRegistry.register('typeAtCoordinates', new TypeAtCoordinatesAction());

    const actions = this.actionRegistry.getAvailableActions();
    logger.info(`Registered ${actions.length} action(s): ${actions.join(', ')}`);
  }

  async start(): Promise<void> {
    logger.info('Starting BrowserOS Controller...');
    await this.wsClient.connect();
  }

  stop(): void {
    logger.info('Stopping BrowserOS Controller...');
    this.wsClient.disconnect();
    this.requestTracker.destroy();
    this.requestValidator.destroy();
    this.responseQueue.clear();
  }

  private _setupWebSocketHandlers(): void {
    // Handle incoming messages
    this.wsClient.onMessage((message: ProtocolResponse) => {
      this._handleIncomingMessage(message);
    });

    // Handle connection status changes
    this.wsClient.onStatusChange((status: ConnectionStatus) => {
      this._handleStatusChange(status);
    });
  }

  private _handleIncomingMessage(message: ProtocolResponse): void {
    // Check if this is a request (has 'action' field) or a response/notification
    const rawMessage = message as any;

    if (rawMessage.action) {
      // This is a request from the server - process it
      this._processRequest(rawMessage).catch((error) => {
        logger.error(`Unhandled error processing request ${rawMessage.id}: ${error}`);
      });
    } else if (rawMessage.ok !== undefined) {
      // This is a response or notification from the server - just log it
      logger.info(`Received server message: ${rawMessage.id} - ${rawMessage.ok ? 'success' : 'error'}`);
      if (rawMessage.data) {
        logger.debug(`Server data: ${JSON.stringify(rawMessage.data)}`);
      }
    } else {
      logger.warn(`Received unknown message format: ${JSON.stringify(rawMessage)}`);
    }
  }

  private async _processRequest(request: unknown): Promise<void> {
    let validatedRequest: ProtocolRequest;
    let requestId: string | undefined;

    try {
      // Step 1: Validate request (checks schema + duplicate IDs)
      validatedRequest = this.requestValidator.validate(request);
      requestId = validatedRequest.id;

      // Step 2: Start tracking
      this.requestTracker.start(validatedRequest.id, validatedRequest.action);

      // Step 3: Execute with concurrency control
      await this.concurrencyLimiter.execute(async () => {
        this.requestTracker.markExecuting(validatedRequest.id);
        await this._executeAction(validatedRequest);
      });

      // Step 4: Mark complete
      this.requestTracker.complete(validatedRequest.id);
      this.requestValidator.markComplete(validatedRequest.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Request processing failed: ${errorMessage}`);

      if (requestId) {
        this.requestTracker.complete(requestId, errorMessage);
        this.requestValidator.markComplete(requestId);

        // Send error response
        this._sendResponse({
          id: requestId,
          ok: false,
          error: errorMessage
        });
      }
    }
  }

  private async _executeAction(request: ProtocolRequest): Promise<void> {
    logger.info(`Executing action: ${request.action} [${request.id}]`);

    // Dispatch to action registry
    const actionResponse = await this.actionRegistry.dispatch(
      request.action,
      request.payload
    );

    // Send response back to server
    this._sendResponse({
      id: request.id,
      ok: actionResponse.ok,
      data: actionResponse.data,
      error: actionResponse.error
    });

    const status = actionResponse.ok ? 'succeeded' : 'failed';
    logger.info(`Action ${status}: ${request.action} [${request.id}]`);
  }

  private _sendResponse(response: ProtocolResponse): void {
    try {
      if (this.wsClient.isConnected()) {
        // Send immediately if connected
        this.wsClient.send(response);
      } else {
        // Queue if disconnected
        logger.warn(`Not connected. Queueing response: ${response.id}`);
        this.responseQueue.enqueue(response);
      }
    } catch (error) {
      logger.error(`Failed to send response ${response.id}: ${error}`);
      // Queue on failure
      this.responseQueue.enqueue(response);
    }
  }

  private _handleStatusChange(status: ConnectionStatus): void {
    logger.info(`Connection status changed: ${status}`);

    if (status === ConnectionStatus.CONNECTED) {
      // Flush queued responses on reconnect
      if (!this.responseQueue.isEmpty()) {
        logger.info(`Flushing ${this.responseQueue.size()} queued responses...`);
        this.responseQueue.flush((response) => {
          this.wsClient.send(response);
        });
      }
    }
  }

  // Diagnostic methods for monitoring
  getStats() {
    return {
      connection: this.wsClient.getStatus(),
      requests: this.requestTracker.getStats(),
      concurrency: this.concurrencyLimiter.getStats(),
      validator: this.requestValidator.getStats(),
      responseQueue: {
        size: this.responseQueue.size()
      }
    };
  }

  logStats(): void {
    const stats = this.getStats();
    logger.info('=== Controller Stats ===');
    logger.info(`Connection: ${stats.connection}`);
    logger.info(`Requests: ${JSON.stringify(stats.requests)}`);
    logger.info(`Concurrency: ${JSON.stringify(stats.concurrency)}`);
    logger.info(`Validator: ${JSON.stringify(stats.validator)}`);
    logger.info(`Response Queue: ${stats.responseQueue.size} queued`);
  }
}

// Global controller instance
let controller: BrowserOSController | null = null;

// Initialize on extension load
logger.info('[BrowserOS Controller] Extension loaded');

chrome.runtime.onInstalled.addListener(() => {
  logger.info('[BrowserOS Controller] Extension installed');
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('[BrowserOS Controller] Browser started');

  if (!controller) {
    const port = await getWebSocketPort();
    controller = new BrowserOSController(port);
    await controller.start();
  }
});

// Start immediately (service worker context)
(async () => {
  if (!controller) {
    const port = await getWebSocketPort();
    controller = new BrowserOSController(port);
    await controller.start();

    // Log stats every 30 seconds
    setInterval(() => {
      if (controller) {
        controller.logStats();
      }
    }, 30000);
  }
})();

// Cleanup on unload
chrome.runtime.onSuspend?.addListener(() => {
  logger.info('[BrowserOS Controller] Extension suspending');
  if (controller) {
    controller.stop();
    controller = null;
  }
});

// Export for debugging in console
(globalThis as any).__browserosController = controller;
