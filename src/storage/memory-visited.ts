/**
 * In-Memory Visited Storage
 * Set-based visited tracking for local development
 */

import { IVisitedStorage } from '../types/storage.js';

export class MemoryVisitedStorage implements IVisitedStorage {
  private visited: Set<string> = new Set();

  async add(url: string): Promise<void> {
    this.visited.add(url);
  }

  async has(url: string): Promise<boolean> {
    return this.visited.has(url);
  }

  async size(): Promise<number> {
    return this.visited.size;
  }

  async clear(): Promise<void> {
    this.visited.clear();
  }

  async getAll(): Promise<string[]> {
    return Array.from(this.visited);
  }
}
