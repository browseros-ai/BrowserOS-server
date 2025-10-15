import { logger } from './Logger';

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
  private inFlight = 0;
  private queue: QueuedTask<any>[] = [];

  constructor(
    private maxConcurrent: number,
    private maxQueueSize: number = 1000
  ) {
    logger.info(`ConcurrencyLimiter initialized: max=${maxConcurrent}, queueSize=${maxQueueSize}`);
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    // If under limit, execute immediately
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight++;
      logger.debug(`Executing immediately (${this.inFlight}/${this.maxConcurrent})`);

      try {
        return await task();
      } finally {
        this.inFlight--;
        this.processQueue();
      }
    }

    // Otherwise, queue (with limit check)
    if (this.queue.length >= this.maxQueueSize) {
      logger.error(`Queue full (${this.maxQueueSize} requests). Rejecting request.`);
      throw new Error(`Controller overloaded. Queue full (${this.maxQueueSize} requests). Server should slow down.`);
    }

    logger.warn(`Queueing request (${this.queue.length + 1}/${this.maxQueueSize} queued)`);

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.inFlight < this.maxConcurrent) {
      const {task, resolve, reject} = this.queue.shift()!;
      this.inFlight++;

      logger.debug(`Processing queued request (${this.queue.length} remaining)`);

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.inFlight--;
          this.processQueue();
        });
    }
  }

  getStats(): ConcurrencyStats {
    return {
      inFlight: this.inFlight,
      queued: this.queue.length,
      utilization: this.maxConcurrent > 0 ? this.inFlight / this.maxConcurrent : 0
    };
  }

  // For debugging
  logStats(): void {
    const stats = this.getStats();
    logger.info(
      `Concurrency: ${stats.inFlight}/${this.maxConcurrent} in-flight, ` +
      `${stats.queued} queued, ` +
      `${Math.round(stats.utilization * 100)}% utilization`
    );
  }
}
