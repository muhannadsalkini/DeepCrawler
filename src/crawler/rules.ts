/**
 * Crawl Rules Engine
 * Enforces crawl limits and filters
 */

import { CrawlOptions } from '../types/crawl.js';
import { getDomain } from './normalizer.js';

export class CrawlRules {
  private options: CrawlOptions;
  private baseDomain: string;

  constructor(options: CrawlOptions) {
    this.options = options;
    this.baseDomain = getDomain(options.startUrl);
  }

  /**
   * Check if URL should be crawled based on depth
   */
  shouldCrawlDepth(depth: number): boolean {
    return depth < this.options.maxDepth;
  }

  /**
   * Check if we've reached the page limit
   */
  hasReachedPageLimit(pagesScraped: number): boolean {
    return pagesScraped >= this.options.maxPages;
  }

  /**
   * Check if URL is in allowed domain (for domain-only strategy)
   */
  isAllowedDomain(url: string): boolean {
    if (this.options.strategy === 'all') {
      return true; // All domains allowed
    }

    try {
      const urlDomain = getDomain(url);
      return urlDomain === this.baseDomain;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is a private/local address
   */
  isPrivateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check for localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
      }

      // Check for private IP ranges
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = hostname.match(ipv4Regex);

      if (match) {
        const octets = match.slice(1, 5).map(Number);
        // 10.0.0.0/8
        if (octets[0] === 10) return true;
        // 172.16.0.0/12
        if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
        // 192.168.0.0/16
        if (octets[0] === 192 && octets[1] === 168) return true;
        // 169.254.0.0/16 (link-local)
        if (octets[0] === 169 && octets[1] === 254) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Combined check: should this URL be crawled?
   */
  shouldCrawl(url: string, depth: number, pagesScraped: number): boolean {
    // Check depth limit
    if (!this.shouldCrawlDepth(depth)) {
      return false;
    }

    // Check page limit
    if (this.hasReachedPageLimit(pagesScraped)) {
      return false;
    }

    // Check domain restriction
    if (!this.isAllowedDomain(url)) {
      return false;
    }

    // Block private URLs
    if (this.isPrivateUrl(url)) {
      return false;
    }

    return true;
  }
}
