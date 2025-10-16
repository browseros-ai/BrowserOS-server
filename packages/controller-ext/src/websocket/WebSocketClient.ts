
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
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private port: number;
  private lastPongReceived: number = Date.now();
  private pendingPing: boolean = false;

  // Event handlers
  private messageHandlers = new Set<(msg: ProtocolResponse) => void>();
  private statusHandlers = new Set<(status: ConnectionStatus) => void>();

  constructor(port: number) {
    this.port = port;
    logger.info(`WebSocketClient initialized with port: ${port}`);
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
    const { protocol, host, path } = WEBSOCKET_CONFIG;
    return `${protocol}://${host}:${this.port}${path}`;
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
    this.lastPongReceived = Date.now();
    this.pendingPing = false;
    this._setStatus(ConnectionStatus.CONNECTED);
    this._startHeartbeat();
  }

  private _handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      // Handle pong response for heartbeat
      if (message.type === 'pong') {
        this.lastPongReceived = Date.now();
        this.pendingPing = false;
        logger.debug('Received pong from server');
        return;
      }

      logger.debug(`Received: ${JSON.stringify(message).substring(0, 100)}...`);

      // Emit to all message handlers
      this.messageHandlers.forEach(handler => handler(message as ProtocolResponse));

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
    const baseDelay = Math.min(
      WEBSOCKET_CONFIG.reconnectDelay *
        Math.pow(WEBSOCKET_CONFIG.reconnectMultiplier, this.reconnectAttempts),
      WEBSOCKET_CONFIG.maxReconnectDelay
    );

    // Add jitter: ±20% random variation to prevent thundering herd
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.max(0, baseDelay + jitter);

    this.reconnectAttempts++;
    logger.warn(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

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
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Check if previous ping timed out
      const timeSinceLastPong = Date.now() - this.lastPongReceived;
      if (timeSinceLastPong > WEBSOCKET_CONFIG.heartbeatInterval + WEBSOCKET_CONFIG.heartbeatTimeout) {
        logger.error(`Heartbeat timeout: no pong received for ${timeSinceLastPong}ms`);
        this._handleHeartbeatTimeout();
        return;
      }

      // Send ping
      try {
        const pingMessage = JSON.stringify({ type: 'ping' });
        this.ws.send(pingMessage);
        this.pendingPing = true;
        logger.debug('Sent heartbeat ping');

        // Set timeout for this specific ping
        this._clearHeartbeatTimeout();
        this.heartbeatTimeoutTimer = setTimeout(() => {
          if (this.pendingPing) {
            logger.error(`Ping timeout: no pong received within ${WEBSOCKET_CONFIG.heartbeatTimeout}ms`);
            this._handleHeartbeatTimeout();
          }
        }, WEBSOCKET_CONFIG.heartbeatTimeout);
      } catch (error) {
        logger.error(`Failed to send ping: ${error}`);
        this._handleHeartbeatTimeout();
      }
    }, WEBSOCKET_CONFIG.heartbeatInterval);
  }

  private _handleHeartbeatTimeout(): void {
    logger.warn('Heartbeat failed, forcing reconnection');
    if (this.ws) {
      this.ws.close();
    }
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this._clearHeartbeatTimeout();
  }

  private _clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
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
