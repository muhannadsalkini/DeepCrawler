/**
 * Crawl Metrics Tracker
 * Tracks progress and statistics during crawling
 */

import { JobMetrics } from '../types/crawl.js';

export class MetricsTracker {
  private metrics: JobMetrics;

  constructor() {
    this.metrics = {
      pagesScraped: 0,
      linksDiscovered: 0,
      errors: 0,
      currentDepth: 0,
    };
  }

  /**
   * Increment pages scraped counter
   */
  incrementPagesScrapped(): void {
    this.metrics.pagesScraped++;
  }

  /**
   * Add to links discovered counter
   */
  addLinksDiscovered(count: number): void {
    this.metrics.linksDiscovered += count;
  }

  /**
   * Increment error counter
   */
  incrementErrors(): void {
    this.metrics.errors++;
  }

  /**
   * Update current depth if greater than existing
   */
  updateDepth(depth: number): void {
    if (depth > this.metrics.currentDepth) {
      this.metrics.currentDepth = depth;
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): JobMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      pagesScraped: 0,
      linksDiscovered: 0,
      errors: 0,
      currentDepth: 0,
    };
  }
}
