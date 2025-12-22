/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import {logger} from './Logger';

export interface TrackedRequest {
  id: string;
  action: string;
  startTime: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

export interface RequestStats {
  inFlight: number;
  avgDuration: number;
  errorRate: number;
  totalRequests: number;
}

export class RequestTracker {
  private requests = new Map<string, TrackedRequest>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of old completed requests
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every 1 minute
  }

  start(id: string, action: string): void {
    this.requests.set(id, {
      id,
      action,
      startTime: Date.now(),
      status: 'pending',
    });
    logger.debug(`Request started: ${id} [${action}]`);
  }

  markExecuting(id: string): void {
    const req = this.requests.get(id);
    if (req) {
      req.status = 'executing';
      logger.debug(`Request executing: ${id}`);
    }
  }

  complete(id: string, error?: string): void {
    const req = this.requests.get(id);
    if (req) {
      req.status = error ? 'failed' : 'completed';
      req.duration = Date.now() - req.startTime;
      req.error = error;

      logger.info(
        `Request ${error ? 'failed' : 'completed'}: ${id} [${req.action}] in ${req.duration}ms`,
      );

      // Schedule cleanup after 1 minute
      setTimeout(() => this.requests.delete(id), 60000);
    }
  }

  getActiveRequests(): TrackedRequest[] {
    return Array.from(this.requests.values()).filter(
      r => r.status === 'pending' || r.status === 'executing',
    );
  }

  getStats(): RequestStats {
    const all = Array.from(this.requests.values());
    const inFlight = all.filter(
      r => r.status === 'pending' || r.status === 'executing',
    ).length;

    const completed = all.filter(r => r.duration !== undefined);
    const avgDuration =
      completed.length > 0
        ? completed.reduce((sum, r) => sum + r.duration!, 0) / completed.length
        : 0;

    const failed = all.filter(r => r.status === 'failed').length;
    const errorRate = all.length > 0 ? failed / all.length : 0;

    return {
      inFlight,
      avgDuration: Math.round(avgDuration),
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: all.length,
    };
  }

  getHungRequests(timeoutMs = 30000): TrackedRequest[] {
    const now = Date.now();
    return Array.from(this.requests.values()).filter(
      r =>
        (r.status === 'pending' || r.status === 'executing') &&
        now - r.startTime > timeoutMs,
    );
  }

  private cleanup(): void {
    // Remove completed/failed requests older than 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    for (const [id, req] of this.requests.entries()) {
      if (
        (req.status === 'completed' || req.status === 'failed') &&
        req.startTime < fiveMinutesAgo
      ) {
        this.requests.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.requests.clear();
  }
}
