/**
 * In-Memory Queue Storage
 * Simple array-based queue for local development
 */

import { QueueItem } from '../types/crawl.js';
import { IQueueStorage } from '../types/storage.js';

export class MemoryQueueStorage implements IQueueStorage {
  private items: QueueItem[] = [];

  async enqueue(item: QueueItem): Promise<void> {
    this.items.push(item);
  }

  async enqueueMany(items: QueueItem[]): Promise<void> {
    this.items.push(...items);
  }

  async dequeue(): Promise<QueueItem | undefined> {
    return this.items.shift();
  }

  async isEmpty(): Promise<boolean> {
    return this.items.length === 0;
  }

  async size(): Promise<number> {
    return this.items.length;
  }

  async clear(): Promise<void> {
    this.items = [];
  }

  async peek(): Promise<QueueItem | undefined> {
    return this.items[0];
  }
}
