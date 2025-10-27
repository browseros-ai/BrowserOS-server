/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from './Logger';

import type {ProtocolResponse} from '@/protocol/types';

export class ResponseQueue {
  private queue: ProtocolResponse[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    logger.info(`ResponseQueue initialized: maxSize=${maxSize}`);
  }

  enqueue(response: ProtocolResponse): void {
    if (this.queue.length >= this.maxSize) {
      // Drop oldest response to prevent memory leak
      const dropped = this.queue.shift();
      logger.warn(
        `Response queue full. Dropped oldest response: ${dropped?.id}`,
      );
    }

    this.queue.push(response);
    logger.debug(
      `Response queued: ${response.id} (queue size: ${this.queue.length})`,
    );
  }

  flush(send: (response: ProtocolResponse) => void): number {
    let sent = 0;

    logger.info(`Flushing ${this.queue.length} queued responses...`);

    while (this.queue.length > 0) {
      const response = this.queue.shift()!;

      try {
        send(response);
        sent++;
      } catch (error) {
        // Re-queue if send fails
        logger.error(
          `Failed to send response ${response.id}: ${error}. Re-queueing.`,
        );
        this.queue.unshift(response);
        break;
      }
    }

    logger.info(`Flushed ${sent} responses. ${this.queue.length} remaining.`);
    return sent;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    logger.warn(`Response queue cleared. Dropped ${count} responses.`);
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
