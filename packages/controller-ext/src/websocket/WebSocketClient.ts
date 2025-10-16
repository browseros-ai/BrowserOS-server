
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { WEBSOCKET_CONFIG } from '@/config/constants';
import type {
  ProtocolRequest,
  ProtocolResponse} from '@/protocol/types';
import {
  ConnectionStatus
} from '@/protocol/types';
import { logger } from '@/utils/Logger';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Event handlers
  private messageHandlers = new Set<(msg: ProtocolResponse) => void>();
  private statusHandlers = new Set<(status: ConnectionStatus) => void>();

  constructor() {
    logger.info('WebSocketClient initialized');
  }

  // Public API

  async connect(): Promise<void> {
    if (this.status === ConnectionStatus.CONNECTED) {
      logger.debug('Already connected');
      return;
    }

    this._setStatus(ConnectionStatus.CONNECTING);

    const url = this._buildUrl();
    logger.info(`Connecting to ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = this._handleOpen.bind(this);
      this.ws.onmessage = this._handleMessage.bind(this);
      this.ws.onerror = this._handleError.bind(this);
      this.ws.onclose = this._handleClose.bind(this);

      // Wait for connection with timeout
      await this._waitForConnection();

    } catch (error) {
      logger.error(`Connection failed: ${error}`);
      this._handleConnectionFailure();
    }
  }

  disconnect(): void {
    logger.info('Disconnecting...');
    this._clearTimers();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._setStatus(ConnectionStatus.DISCONNECTED);
  }

  send(message: ProtocolRequest | ProtocolResponse): void {
    if (this.status !== ConnectionStatus.CONNECTED) {
      throw new Error('WebSocket not connected');
    }

    if (!this.ws) {
      throw new Error('WebSocket instance is null');
    }

    const messageStr = JSON.stringify(message);
    logger.debug(`Sending: ${messageStr.substring(0, 100)}...`);
    this.ws.send(messageStr);
  }

  onMessage(handler: (msg: ProtocolResponse) => void): void {
    this.messageHandlers.add(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.add(handler);
  }

  isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Private methods

  private _buildUrl(): string {
    const { protocol, host, port, path } = WEBSOCKET_CONFIG;
    return `${protocol}://${host}:${port}${path}`;
  }

  private async _waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, WEBSOCKET_CONFIG.connectionTimeout);

      const checkConnection = () => {
        if (this.status === ConnectionStatus.CONNECTED) {
          clearTimeout(timeout);
          resolve();
        } else if (this.status === ConnectionStatus.ERROR) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  private _handleOpen(): void {
    logger.info('WebSocket connected');
    this.reconnectAttempts = 0;
    this._setStatus(ConnectionStatus.CONNECTED);
    this._startHeartbeat();
  }

  private _handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ProtocolResponse;
      logger.debug(`Received: ${JSON.stringify(message).substring(0, 100)}...`);

      // Emit to all message handlers
      this.messageHandlers.forEach(handler => handler(message));

    } catch (error) {
      logger.error(`Failed to parse message: ${error}`);
    }
  }

  private _handleError(event: Event): void {
    logger.error(`WebSocket error: ${event}`);
    this._setStatus(ConnectionStatus.ERROR);
  }

  private _handleClose(event: CloseEvent): void {
    logger.warn(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
    this._clearTimers();
    this.ws = null;

    // Only reconnect if we're not deliberately disconnecting
    if (this.status !== ConnectionStatus.DISCONNECTED) {
      this._reconnect();
    }
  }

  private _handleConnectionFailure(): void {
    this._setStatus(ConnectionStatus.ERROR);
    this._reconnect();
  }

  private _reconnect(): void {
    if (this.reconnectTimer) {
      return; // Already reconnecting
    }

    this._setStatus(ConnectionStatus.RECONNECTING);

    // Calculate delay with exponential backoff
    const delay = Math.min(
      WEBSOCKET_CONFIG.reconnectDelay *
        Math.pow(WEBSOCKET_CONFIG.reconnectMultiplier, this.reconnectAttempts),
      WEBSOCKET_CONFIG.maxReconnectDelay
    );

    this.reconnectAttempts++;
    logger.warn(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(err => {
        logger.error(`Reconnection failed: ${err}`);
      });
    }, delay);
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        logger.debug('Sending heartbeat ping');
        // Note: Actual ping/pong implementation depends on server protocol
        // For now, we just check connection state
      }
    }, WEBSOCKET_CONFIG.heartbeatInterval);
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private _clearTimers(): void {
    this._clearHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;

    this.status = status;
    logger.info(`Status changed: ${status}`);

    // Emit to all status handlers
    this.statusHandlers.forEach(handler => handler(status));
  }
}
