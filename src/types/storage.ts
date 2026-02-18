/**
 * Storage Interfaces
 * Abstractions for queue and visited tracking to enable Redis migration
 */

import { QueueItem } from './crawl.js';

/**
 * Queue Storage Interface
 * Can be implemented with in-memory or Redis
 */
export interface IQueueStorage {
  /**
   * Add item to queue
   */
  enqueue(item: QueueItem): Promise<void>;

  /**
   * Add multiple items to queue
   */
  enqueueMany(items: QueueItem[]): Promise<void>;

  /**
   * Remove and return next item from queue
   */
  dequeue(): Promise<QueueItem | undefined>;

  /**
   * Check if queue is empty
   */
  isEmpty(): Promise<boolean>;

  /**
   * Get queue size
   */
  size(): Promise<number>;

  /**
   * Clear all items
   */
  clear(): Promise<void>;

  /**
   * Peek at next item without removing
   */
  peek(): Promise<QueueItem | undefined>;
}

/**
 * Visited Storage Interface
 * Can be implemented with in-memory Set or Redis Set
 */
export interface IVisitedStorage {
  /**
   * Add URL to visited set
   */
  add(url: string): Promise<void>;

  /**
   * Check if URL has been visited
   */
  has(url: string): Promise<boolean>;

  /**
   * Get count of visited URLs
   */
  size(): Promise<number>;

  /**
   * Clear all visited URLs
   */
  clear(): Promise<void>;

  /**
   * Get all visited URLs (for debugging)
   */
  getAll(): Promise<string[]>;
}
