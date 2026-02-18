/**
 * Storage Factory
 * Creates appropriate storage implementations based on configuration
 */

import { IQueueStorage, IVisitedStorage } from '../types/storage.js';
import { MemoryQueueStorage } from './memory-queue.js';
import { MemoryVisitedStorage } from './memory-visited.js';

/**
 * Create queue storage instance
 */
export function createQueueStorage(): IQueueStorage {
  const storageType = process.env.STORAGE_TYPE || 'memory';

  switch (storageType) {
    case 'memory':
      return new MemoryQueueStorage();
    // Future: Add Redis implementation
    // case 'redis':
    //   return new RedisQueueStorage();
    default:
      return new MemoryQueueStorage();
  }
}

/**
 * Create visited storage instance
 */
export function createVisitedStorage(): IVisitedStorage {
  const storageType = process.env.STORAGE_TYPE || 'memory';

  switch (storageType) {
    case 'memory':
      return new MemoryVisitedStorage();
    // Future: Add Redis implementation
    // case 'redis':
    //   return new RedisVisitedStorage();
    default:
      return new MemoryVisitedStorage();
  }
}
