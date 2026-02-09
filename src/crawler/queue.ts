/**
 * BFS Queue for Crawling
 * First-In-First-Out queue with queue items containing URL and depth
 */

import { QueueItem } from '../types/crawl.js';

export class CrawlQueue {
  private items: QueueItem[] = [];

  /**
   * Add item to the end of the queue
   */
  enqueue(item: QueueItem): void {
    this.items.push(item);
  }

  /**
   * Add multiple items to the queue
   */
  enqueueMany(items: QueueItem[]): void {
    this.items.push(...items);
  }

  /**
   * Remove and return item from the front of the queue
   */
  dequeue(): QueueItem | undefined {
    return this.items.shift();
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Peek at the next item without removing it
   */
  peek(): QueueItem | undefined {
    return this.items[0];
  }
}
