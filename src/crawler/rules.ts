/**
 * Crawl Rules Engine
 * Enforces crawl limits and filters
 */

import { CrawlOptions } from '../types/crawl.js';
import { getDomain } from './normalizer.js';
import { isPrivateIp } from '../utils/ssrf-guard.js';

// Hostnames that are always private regardless of DNS resolution.
// Mirrors the BLOCKED_HOSTNAMES set in ssrf-guard.ts so rules.ts
// can perform a fast synchronous pre-filter before the engine runs
// the full async DNS-resolving assertSafeUrl() check.
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
]);

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
   * Check if URL is a private/local address.
   *
   * This is a synchronous fast-path filter that catches the most common
   * cases. It covers:
   *   - All blocked hostnames (localhost, 0.0.0.0, ::1, IPv4-mapped loopback)
   *   - All private IPv4 ranges (RFC 1918, link-local, cloud metadata, etc.)
   *   - All private IPv6 ranges (loopback, unique-local, link-local, mapped)
   *
   * NOTE: decimal/octal/hex IP encoding tricks (e.g. http://2130706433/)
   * are defeated by the async `assertSafeUrl()` call in engine.ts which
   * performs DNS resolution and validates the *resolved* IP address.
   */
  isPrivateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Fast blocklist check (catches localhost, 0.0.0.0, ::ffff:127.0.0.1, etc.)
      if (BLOCKED_HOSTNAMES.has(hostname)) return true;

      // Comprehensive IP range check from ssrf-guard (covers all RFC 1918,
      // link-local, cloud metadata, IPv6 private, and reserved ranges)
      return isPrivateIp(hostname);
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
