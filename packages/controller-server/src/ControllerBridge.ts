/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {logger} from '@browseros/common';
import type {WebSocket} from 'ws';
import {WebSocketServer} from 'ws';

interface ControllerRequest {
  id: string;
  action: string;
  payload: unknown;
}

interface ControllerResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class ControllerBridge {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private connected = false;
  private requestCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();
  private logger: typeof logger;

  constructor(port: number, logger: typeof logger) {
    this.logger = logger;

    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
    });

    this.wss.on('listening', () => {
      this.logger.info(`WebSocket server listening on ws://127.0.0.1:${port}`);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.info('Extension connected');
      this.client = ws;
      this.connected = true;

      ws.on('message', (data: Buffer) => {
        try {
          const message = data.toString();
          const parsed = JSON.parse(message);

          // Handle ping/pong for heartbeat
          if (parsed.type === 'ping') {
            this.logger.debug('Received ping, sending pong');
            ws.send(JSON.stringify({type: 'pong'}));
            return;
          }

          this.logger.debug(
            `Received message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
          );
          const response = parsed as ControllerResponse;
          this.handleResponse(response);
        } catch (error) {
          this.logger.error(`Error parsing message: ${error}`);
        }
      });

      ws.on('close', () => {
        this.logger.info('Extension disconnected');
        this.connected = false;
        this.client = null;

        for (const [id, pending] of this.pendingRequests.entries()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
          this.pendingRequests.delete(id);
        }
      });

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error: ${error.message}`);
      });
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error(`WebSocket server error: ${error.message}`);
    });
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async sendRequest(
    action: string,
    payload: unknown,
    timeoutMs = 30000,
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('Extension not connected');
    }

    const id = `${Date.now()}-${++this.requestCounter}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {resolve, reject, timeout});

      const request: ControllerRequest = {id, action, payload};
      try {
        const message = JSON.stringify(request);
        this.logger.debug(`Sending request: ${message}`);
        this.client!.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private handleResponse(response: ControllerResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      this.logger.warn(
        `Received response for unknown request ID: ${response.id}`,
      );
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.ok) {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error || 'Unknown error'));
    }
  }

  async close(): Promise<void> {
    return new Promise(resolve => {
      if (this.client) {
        this.client.close();
        this.client = null;
      }

      this.wss.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}
