/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from './Logger';

interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface ConcurrencyStats {
  inFlight: number;
  queued: number;
  utilization: number;
}

export class ConcurrencyLimiter {
  private isProcessing = false;
  private queue: Array<QueuedTask<any>> = [];

  constructor(
    private maxConcurrent: number,
    private maxQueueSize = 1000,
  ) {
    if (maxConcurrent !== 1) {
      logger.warn(
        `ConcurrencyLimiter: maxConcurrent=${maxConcurrent} but extension is single-threaded. ` +
          `Using mutex mode (sequential execution) to prevent race conditions.`,
      );
    }
    logger.info(
      `ConcurrencyLimiter initialized: sequential=true, queueSize=${maxQueueSize}`,
    );
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    // Queue limit check first
    if (this.queue.length >= this.maxQueueSize) {
      logger.error(
        `Queue full (${this.maxQueueSize} requests). Rejecting request.`,
      );
      throw new Error(
        `Controller overloaded. Queue full (${this.maxQueueSize} requests). Server should slow down.`,
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
      });

      const status = this.isProcessing ? 'QUEUED (mutex held)' : 'IMMEDIATE';
      logger.info(
        `[MUTEX] Task arrival - Status: ${status}, Queue size now: ${this.queue.length}`,
      );

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private processQueue(): void {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // Log BEFORE we remove from queue to show true queue size
    const queueSizeBeforeRemoval = this.queue.length;

    this.isProcessing = true;
    const {task, resolve, reject} = this.queue.shift()!;

    logger.info(
      `[MUTEX] Acquired. Started processing (${queueSizeBeforeRemoval} task(s) were queued, ${this.queue.length} still waiting).`,
    );

    const startTime = Date.now();

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        const duration = Date.now() - startTime;
        this.isProcessing = false;

        logger.info(
          `[MUTEX] Released after ${duration}ms. ${this.queue.length} task(s) remaining.`,
        );

        this.processQueue();
      });
  }

  getStats(): ConcurrencyStats {
    return {
      inFlight: this.isProcessing ? 1 : 0,
      queued: this.queue.length,
      utilization: this.isProcessing ? 1.0 : 0.0,
    };
  }

  // For debugging
  logStats(): void {
    const stats = this.getStats();
    logger.info(
      `Concurrency: ${stats.inFlight} in-flight (mutex mode), ` +
        `${stats.queued} queued, ` +
        `${Math.round(stats.utilization * 100)}% utilization`,
    );
  }
}
