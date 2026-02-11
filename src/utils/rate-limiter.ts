/**
 * Rate Limiter
 * Controls request rate to prevent overwhelming servers
 */

import Bottleneck from 'bottleneck';
import { logger } from '../utils/logger.js';

export class RateLimiter {
  private limiter: Bottleneck;

  constructor(options: {
    minTime?: number; // Minimum time between requests (ms)
    maxConcurrent?: number; // Max concurrent requests
  }) {
    const minTime = options.minTime ?? 1000; // Default: 1 request per second
    const maxConcurrent = options.maxConcurrent ?? 5;

    this.limiter = new Bottleneck({
      minTime,
      maxConcurrent,
      reservoir: 100, // Token bucket size
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 60 * 1000, // Refill every minute
    });

    logger.info('Rate limiter initialized', { minTime, maxConcurrent });
  }

  /**
   * Schedule a function to run with rate limiting
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn);
  }

  /**
   * Get current limiter status
   */
  getStatus() {
    return {
      running: this.limiter.running(),
      queued: this.limiter.queued(),
    };
  }

  /**
   * Clear all queued requests
   */
  clear() {
    this.limiter.stop({ dropWaitingJobs: true });
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter({
  minTime: parseInt(process.env.MIN_REQUEST_TIME || '1000', 10),
  maxConcurrent: parseInt(process.env.DEFAULT_CONCURRENCY || '5', 10),
});
