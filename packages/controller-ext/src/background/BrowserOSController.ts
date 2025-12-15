/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {ActionRegistry} from '@/actions/ActionRegistry';
import {CreateBookmarkAction} from '@/actions/bookmark/CreateBookmarkAction';
import {GetBookmarksAction} from '@/actions/bookmark/GetBookmarksAction';
import {RemoveBookmarkAction} from '@/actions/bookmark/RemoveBookmarkAction';
import {CaptureScreenshotAction} from '@/actions/browser/CaptureScreenshotAction';
import {ClearAction} from '@/actions/browser/ClearAction';
import {ClickAction} from '@/actions/browser/ClickAction';
import {ClickCoordinatesAction} from '@/actions/browser/ClickCoordinatesAction';
import {ExecuteJavaScriptAction} from '@/actions/browser/ExecuteJavaScriptAction';
import {GetAccessibilityTreeAction} from '@/actions/browser/GetAccessibilityTreeAction';
import {GetInteractiveSnapshotAction} from '@/actions/browser/GetInteractiveSnapshotAction';
import {GetPageLoadStatusAction} from '@/actions/browser/GetPageLoadStatusAction';
import {GetSnapshotAction} from '@/actions/browser/GetSnapshotAction';
import {InputTextAction} from '@/actions/browser/InputTextAction';
import {ScrollDownAction} from '@/actions/browser/ScrollDownAction';
import {ScrollToNodeAction} from '@/actions/browser/ScrollToNodeAction';
import {ScrollUpAction} from '@/actions/browser/ScrollUpAction';
import {SendKeysAction} from '@/actions/browser/SendKeysAction';
import {TypeAtCoordinatesAction} from '@/actions/browser/TypeAtCoordinatesAction';
import {CheckBrowserOSAction} from '@/actions/diagnostics/CheckBrowserOSAction';
import {GetRecentHistoryAction} from '@/actions/history/GetRecentHistoryAction';
import {SearchHistoryAction} from '@/actions/history/SearchHistoryAction';
import {CloseTabAction} from '@/actions/tab/CloseTabAction';
import {GetActiveTabAction} from '@/actions/tab/GetActiveTabAction';
import {GetTabsAction} from '@/actions/tab/GetTabsAction';
import {NavigateAction} from '@/actions/tab/NavigateAction';
import {OpenTabAction} from '@/actions/tab/OpenTabAction';
import {SwitchTabAction} from '@/actions/tab/SwitchTabAction';
import {CONCURRENCY_CONFIG} from '@/config/constants';
import type {ProtocolRequest, ProtocolResponse} from '@/protocol/types';
import {ConnectionStatus} from '@/protocol/types';
import {ConcurrencyLimiter} from '@/utils/ConcurrencyLimiter';
import {logger} from '@/utils/Logger';
import {RequestTracker} from '@/utils/RequestTracker';
import {RequestValidator} from '@/utils/RequestValidator';
import {ResponseQueue} from '@/utils/ResponseQueue';
import type {PortProvider} from '@/websocket/WebSocketClient';
import {WebSocketClient} from '@/websocket/WebSocketClient';

/**
 * BrowserOS Controller
 *
 * Main controller class that orchestrates all components.
 * Message flow: WebSocket → Validator → Tracker → Limiter → Action → Response/Queue → WebSocket
 */
export class BrowserOSController {
  private wsClient: WebSocketClient;
  private requestTracker: RequestTracker;
  private concurrencyLimiter: ConcurrencyLimiter;
  private requestValidator: RequestValidator;
  private responseQueue: ResponseQueue;
  private actionRegistry: ActionRegistry;

  constructor(getPort: PortProvider) {
    logger.info('Initializing BrowserOS Controller...');

    this.requestTracker = new RequestTracker();
    this.concurrencyLimiter = new ConcurrencyLimiter(
      CONCURRENCY_CONFIG.maxConcurrent,
      CONCURRENCY_CONFIG.maxQueueSize,
    );
    this.requestValidator = new RequestValidator();
    this.responseQueue = new ResponseQueue();
    this.wsClient = new WebSocketClient(getPort);
    this.actionRegistry = new ActionRegistry();

    this.registerActions();
    this.setupWebSocketHandlers();
  }

  async start(): Promise<void> {
    logger.info('Starting BrowserOS Controller...');
    await this.wsClient.connect();
    // Report owned windows after connection is established
    await this.reportOwnedWindows();
  }

  private async reportOwnedWindows(): Promise<void> {
    try {
      const windows = await chrome.windows.getAll();
      const windowIds = windows
        .map(w => w.id)
        .filter((id): id is number => id !== undefined);

      if (windowIds.length > 0) {
        this.wsClient.send({type: 'register_windows', windowIds});
        logger.info('Reported owned windows to server', {
          windowCount: windowIds.length,
          windowIds,
        });
      }
    } catch (error) {
      logger.warn('Failed to report owned windows', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  notifyWindowCreated(windowId: number): void {
    try {
      this.wsClient.send({type: 'window_created', windowId});
      logger.debug('Sent window_created event', {windowId});
    } catch (error) {
      logger.warn('Failed to send window_created event', {
        windowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  notifyWindowRemoved(windowId: number): void {
    try {
      this.wsClient.send({type: 'window_removed', windowId});
      logger.debug('Sent window_removed event', {windowId});
    } catch (error) {
      logger.warn('Failed to send window_removed event', {
        windowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  stop(): void {
    logger.info('Stopping BrowserOS Controller...');
    this.wsClient.disconnect();
    this.requestTracker.destroy();
    this.requestValidator.destroy();
    this.responseQueue.clear();
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

  getStats() {
    return {
      connection: this.wsClient.getStatus(),
      requests: this.requestTracker.getStats(),
      concurrency: this.concurrencyLimiter.getStats(),
      validator: this.requestValidator.getStats(),
      responseQueue: {
        size: this.responseQueue.size(),
      },
    };
  }

  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  notifyWindowFocused(windowId?: number): void {
    try {
      this.wsClient.send({type: 'focused', windowId});
      logger.debug('Sent focused event', {windowId});
    } catch (error) {
      logger.warn('Failed to send focused event', {
        windowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private registerActions(): void {
    logger.info('Registering actions...');

    this.actionRegistry.register('checkBrowserOS', new CheckBrowserOSAction());

    this.actionRegistry.register('getActiveTab', new GetActiveTabAction());
    this.actionRegistry.register('getTabs', new GetTabsAction());
    this.actionRegistry.register('openTab', new OpenTabAction());
    this.actionRegistry.register('closeTab', new CloseTabAction());
    this.actionRegistry.register('switchTab', new SwitchTabAction());
    this.actionRegistry.register('navigate', new NavigateAction());

    this.actionRegistry.register('getBookmarks', new GetBookmarksAction());
    this.actionRegistry.register('createBookmark', new CreateBookmarkAction());
    this.actionRegistry.register('removeBookmark', new RemoveBookmarkAction());

    this.actionRegistry.register('searchHistory', new SearchHistoryAction());
    this.actionRegistry.register(
      'getRecentHistory',
      new GetRecentHistoryAction(),
    );

    this.actionRegistry.register(
      'getInteractiveSnapshot',
      new GetInteractiveSnapshotAction(),
    );
    this.actionRegistry.register('click', new ClickAction());
    this.actionRegistry.register('inputText', new InputTextAction());
    this.actionRegistry.register('clear', new ClearAction());
    this.actionRegistry.register('scrollToNode', new ScrollToNodeAction());

    this.actionRegistry.register(
      'captureScreenshot',
      new CaptureScreenshotAction(),
    );

    this.actionRegistry.register('scrollDown', new ScrollDownAction());
    this.actionRegistry.register('scrollUp', new ScrollUpAction());

    this.actionRegistry.register(
      'executeJavaScript',
      new ExecuteJavaScriptAction(),
    );
    this.actionRegistry.register('sendKeys', new SendKeysAction());
    this.actionRegistry.register(
      'getPageLoadStatus',
      new GetPageLoadStatusAction(),
    );
    this.actionRegistry.register('getSnapshot', new GetSnapshotAction());
    this.actionRegistry.register(
      'getAccessibilityTree',
      new GetAccessibilityTreeAction(),
    );
    this.actionRegistry.register(
      'clickCoordinates',
      new ClickCoordinatesAction(),
    );
    this.actionRegistry.register(
      'typeAtCoordinates',
      new TypeAtCoordinatesAction(),
    );

    const actions = this.actionRegistry.getAvailableActions();
    logger.info(
      `Registered ${actions.length} action(s): ${actions.join(', ')}`,
    );
  }

  private setupWebSocketHandlers(): void {
    this.wsClient.onMessage((message: ProtocolResponse) => {
      this.handleIncomingMessage(message);
    });

    this.wsClient.onStatusChange((status: ConnectionStatus) => {
      this.handleStatusChange(status);
    });
  }

  private handleIncomingMessage(message: ProtocolResponse): void {
    const rawMessage = message as any;

    if (rawMessage.action) {
      this.processRequest(rawMessage).catch(error => {
        logger.error(
          `Unhandled error processing request ${rawMessage.id}: ${error}`,
        );
      });
    } else if (rawMessage.ok !== undefined) {
      logger.info(
        `Received server message: ${rawMessage.id} - ${rawMessage.ok ? 'success' : 'error'}`,
      );
      if (rawMessage.data) {
        logger.debug(`Server data: ${JSON.stringify(rawMessage.data)}`);
      }
    } else {
      logger.warn(
        `Received unknown message format: ${JSON.stringify(rawMessage)}`,
      );
    }
  }

  private async processRequest(request: unknown): Promise<void> {
    let validatedRequest: ProtocolRequest;
    let requestId: string | undefined;

    try {
      validatedRequest = this.requestValidator.validate(request);
      requestId = validatedRequest.id;

      this.requestTracker.start(validatedRequest.id, validatedRequest.action);

      await this.concurrencyLimiter.execute(async () => {
        this.requestTracker.markExecuting(validatedRequest.id);
        await this.executeAction(validatedRequest);
      });

      this.requestTracker.complete(validatedRequest.id);
      this.requestValidator.markComplete(validatedRequest.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Request processing failed: ${errorMessage}`);

      if (requestId) {
        this.requestTracker.complete(requestId, errorMessage);
        this.requestValidator.markComplete(requestId);

        this.sendResponse({
          id: requestId,
          ok: false,
          error: errorMessage,
        });
      }
    }
  }

  private async executeAction(request: ProtocolRequest): Promise<void> {
    logger.info(`Executing action: ${request.action} [${request.id}]`);

    const actionResponse = await this.actionRegistry.dispatch(
      request.action,
      request.payload,
    );

    this.sendResponse({
      id: request.id,
      ok: actionResponse.ok,
      data: actionResponse.data,
      error: actionResponse.error,
    });

    const status = actionResponse.ok ? 'succeeded' : 'failed';
    logger.info(`Action ${status}: ${request.action} [${request.id}]`);
  }

  private sendResponse(response: ProtocolResponse): void {
    try {
      if (this.wsClient.isConnected()) {
        this.wsClient.send(response);
      } else {
        logger.warn(`Not connected. Queueing response: ${response.id}`);
        this.responseQueue.enqueue(response);
      }
    } catch (error) {
      logger.error(`Failed to send response ${response.id}: ${error}`);
      this.responseQueue.enqueue(response);
    }
  }

  private handleStatusChange(status: ConnectionStatus): void {
    logger.info(`Connection status changed: ${status}`);

    if (status === ConnectionStatus.CONNECTED) {
      if (!this.responseQueue.isEmpty()) {
        logger.info(
          `Flushing ${this.responseQueue.size()} queued responses...`,
        );
        this.responseQueue.flush(response => {
          this.wsClient.send(response);
        });
      }
    }
  }
}
