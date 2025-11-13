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
  private clients = new Map<string, WebSocket>();
  private primaryClientId: string | null = null;
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
      const clientId = this.registerClient(ws);
      this.logger.info('Extension connected', {clientId});

      ws.on('message', (data: Buffer) => {
        try {
          const message = data.toString();
          const parsed = JSON.parse(message);

          // Handle ping/pong for heartbeat
          if (parsed.type === 'ping') {
            this.logger.debug('Received ping, sending pong', {clientId});
            ws.send(JSON.stringify({type: 'pong'}));
            return;
          }

          this.logger.debug('Received message from controller client', {
            clientId,
            message,
          });
          const response = parsed as ControllerResponse;
          this.handleResponse(response);
        } catch (error) {
          this.logger.error(`Error parsing message from ${clientId}: ${error}`);
        }
      });

      ws.on('close', () => {
        this.logger.info('Extension disconnected', {clientId});
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for ${clientId}: ${error.message}`);
      });
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error(`WebSocket server error: ${error.message}`);
    });
  }

  isConnected(): boolean {
    return this.primaryClientId !== null;
  }

  async sendRequest(
    action: string,
    payload: unknown,
    timeoutMs = 30000,
  ): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error('Extension not connected');
    }

    const client = this.getPrimaryClient();
    if (!client) {
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
        this.logger.debug(`Sending request to ${this.primaryClientId}: ${message}`);
        client.send(message);
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
      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('ControllerBridge closing'));
        this.pendingRequests.delete(id);
      }

      for (const ws of this.clients.values()) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      this.clients.clear();
      this.primaryClientId = null;

      this.wss.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });
  }

  private registerClient(ws: WebSocket): string {
    const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    this.clients.set(clientId, ws);

    if (!this.primaryClientId) {
      this.primaryClientId = clientId;
      this.logger.info('Primary controller assigned', {clientId});
    } else {
      this.logger.info('Controller connected in standby mode', {clientId, primaryClientId: this.primaryClientId});
    }

    return clientId;
  }

  private getPrimaryClient(): WebSocket | null {
    if (!this.primaryClientId) {
      return null;
    }
    return this.clients.get(this.primaryClientId) ?? null;
  }

  private handleClientDisconnect(clientId: string): void {
    const wasPrimary = this.primaryClientId === clientId;
    this.clients.delete(clientId);

    if (wasPrimary) {
      this.primaryClientId = null;

      for (const [id, pending] of this.pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Primary connection closed'));
        this.pendingRequests.delete(id);
      }

      this.promoteNextPrimary();
    }
  }

  private promoteNextPrimary(): void {
    const nextEntry = this.clients.keys().next();
    if (nextEntry.done) {
      this.logger.warn('No controller connections available to promote');
      return;
    }

    this.primaryClientId = nextEntry.value;
    this.logger.info('Promoted controller to primary', {clientId: this.primaryClientId});
  }
}
