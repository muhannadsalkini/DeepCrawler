/**
 * Robots.txt Parser and Checker
 * Ensures compliance with robots.txt rules
 */

import { fetch } from '../crawler/fetcher.js';
import { logger } from './logger.js';

interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export class RobotsChecker {
  private cache: Map<string, { rules: RobotsRule[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Check if URL is allowed by robots.txt
   */
  async isAllowed(url: string, userAgent: string = 'DeepCrawler'): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      const path = urlObj.pathname + urlObj.search;

      const rules = await this.getRules(baseUrl);

      // Find applicable rules for our user agent
      const applicableRules = this.findApplicableRules(rules, userAgent);

      // Check if path is allowed
      return this.isPathAllowed(path, applicableRules);
    } catch (error) {
      logger.warn('Failed to check robots.txt, allowing by default', {
        url,
        error: (error as Error).message,
      });
      return true; // Allow if robots.txt check fails
    }
  }

  /**
   * Get crawl delay from robots.txt
   */
  async getCrawlDelay(url: string, userAgent: string = 'DeepCrawler'): Promise<number | undefined> {
    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      const rules = await this.getRules(baseUrl);
      const applicableRules = this.findApplicableRules(rules, userAgent);

      return applicableRules.crawlDelay;
    } catch {
      return undefined;
    }
  }

  /**
   * Fetch and parse robots.txt
   */
  private async getRules(baseUrl: string): Promise<RobotsRule[]> {
    // Check cache
    const cached = this.cache.get(baseUrl);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.rules;
    }

    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      const response = await fetch(robotsUrl, { timeout: 5000 });

      const rules = this.parseRobotsTxt(response.html);
      this.cache.set(baseUrl, { rules, timestamp: Date.now() });

      logger.debug('Fetched robots.txt', { baseUrl, rulesCount: rules.length });

      return rules;
    } catch (error) {
      // If robots.txt doesn't exist or fails, allow everything
      const defaultRules: RobotsRule[] = [
        {
          userAgent: '*',
          allow: ['/'],
          disallow: [],
        },
      ];
      this.cache.set(baseUrl, { rules: defaultRules, timestamp: Date.now() });
      return defaultRules;
    }
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string): RobotsRule[] {
    const rules: RobotsRule[] = [];
    let currentRule: RobotsRule | null = null;

    const lines = content.split('\n');

    for (let line of lines) {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      if (!key || !value) continue;

      const normalizedKey = key.trim().toLowerCase();

      if (normalizedKey === 'user-agent') {
        if (currentRule) {
          rules.push(currentRule);
        }
        currentRule = {
          userAgent: value,
          allow: [],
          disallow: [],
        };
      } else if (currentRule) {
        if (normalizedKey === 'disallow') {
          currentRule.disallow.push(value);
        } else if (normalizedKey === 'allow') {
          currentRule.allow.push(value);
        } else if (normalizedKey === 'crawl-delay') {
          const delay = parseFloat(value);
          if (!isNaN(delay)) {
            currentRule.crawlDelay = delay * 1000; // Convert to ms
          }
        }
      }
    }

    if (currentRule) {
      rules.push(currentRule);
    }

    return rules;
  }

  /**
   * Find applicable rules for user agent
   */
  private findApplicableRules(rules: RobotsRule[], userAgent: string): RobotsRule {
    const userAgentLower = userAgent.toLowerCase();

    // Try exact match or partial match
    const exactMatch = rules.find((r) => r.userAgent.toLowerCase() === userAgentLower);
    if (exactMatch) return exactMatch;

    const partialMatch = rules.find((r) => userAgentLower.includes(r.userAgent.toLowerCase()));
    if (partialMatch) return partialMatch;

    // Fall back to wildcard
    const wildcardMatch = rules.find((r) => r.userAgent === '*');
    if (wildcardMatch) return wildcardMatch;

    // Default: allow everything
    return {
      userAgent: '*',
      allow: ['/'],
      disallow: [],
    };
  }

  /**
   * Check if path is allowed by rules
   */
  private isPathAllowed(path: string, rules: RobotsRule): boolean {
    // Check explicit allow rules first
    for (const pattern of rules.allow) {
      if (this.matchesPattern(path, pattern)) {
        return true;
      }
    }

    // Check disallow rules
    for (const pattern of rules.disallow) {
      if (pattern === '' || pattern === '/') {
        // Empty disallow means allow all
        if (pattern === '') continue;
      }

      if (this.matchesPattern(path, pattern)) {
        return false;
      }
    }

    // If no rules matched, allow by default
    return true;
  }

  /**
   * Check if path matches robots.txt pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Simple prefix matching for robots.txt patterns
    // robots.txt uses prefix matching, not full regex
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }

    return path.startsWith(pattern);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Global instance
export const robotsChecker = new RobotsChecker();
