/**
 * Crawl Engine
 * Core crawling logic using BFS algorithm
 */

import { CrawlOptions, CrawlResult, PageData, CrawlError, QueueItem } from '../types/crawl.js';
import { CrawlQueue } from './queue.js';
import { CrawlRules } from './rules.js';
import { MetricsTracker } from './metrics.js';
import { fetch } from './fetcher.js';
import { parse } from './parser.js';
import { extractLinks } from './extractor.js';
import { normalizeUrl } from './normalizer.js';
import { logger } from '../utils/logger.js';
import { Timer } from '../utils/timer.js';

/**
 * Main crawl engine implementation
 */
export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const timer = new Timer();
  const queue = new CrawlQueue();
  const visited = new Set<string>();
  const rules = new CrawlRules(options);
  const metrics = new MetricsTracker();

  const pages: PageData[] = [];
  const errors: CrawlError[] = [];

  // Normalize and enqueue start URL
  const startUrl = normalizeUrl(options.startUrl);
  queue.enqueue({ url: startUrl, depth: 0 });

  logger.info('Crawl started', {
    startUrl,
    strategy: options.strategy,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
  });

  // BFS crawl loop
  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    if (!current) break;

    const { url, depth, parentUrl } = current;

    // Skip if already visited
    if (visited.has(url)) {
      continue;
    }

    // Mark as visited
    visited.add(url);

    // Check if we should crawl this URL
    if (!rules.shouldCrawl(url, depth, metrics.getMetrics().pagesScraped)) {
      logger.debug('Skipping URL due to rules', { url, depth });
      continue;
    }

    // Update depth metric
    metrics.updateDepth(depth);

    try {
      // Fetch and parse page
      logger.debug('Crawling URL', { url, depth, parentUrl });

      const fetchResult = await fetch(url, {
        timeout: options.timeout,
        userAgent: process.env.USER_AGENT || 'DeepCrawler/1.0',
      });

      const parsed = parse(fetchResult.html, url);
      const links = extractLinks(parsed.links, url);

      // Store page data
      const pageData: PageData = {
        url,
        title: parsed.title,
        text: parsed.text,
        links,
        depth,
        scrapedAt: Date.now(),
        meta: parsed.meta,
      };

      pages.push(pageData);
      metrics.incrementPagesScrapped();
      metrics.addLinksDiscovered(links.length);

      logger.debug('Page scraped successfully', {
        url,
        linksFound: links.length,
        depth,
      });

      // Enqueue discovered links for next depth level
      if (depth + 1 < options.maxDepth) {
        const newItems: QueueItem[] = links.map((link) => ({
          url: link,
          depth: depth + 1,
          parentUrl: url,
        }));

        queue.enqueueMany(newItems);
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to crawl URL', err, { url, depth });

      errors.push({
        url,
        error: err.message,
        timestamp: Date.now(),
      });

      metrics.incrementErrors();
    }

    // Check if we've reached page limit
    if (rules.hasReachedPageLimit(metrics.getMetrics().pagesScraped)) {
      logger.info('Reached page limit, stopping crawl', {
        pagesScraped: metrics.getMetrics().pagesScraped,
        maxPages: options.maxPages,
      });
      break;
    }
  }

  const duration = timer.elapsed();
  const finalMetrics = metrics.getMetrics();

  logger.info('Crawl completed', {
    pagesScraped: finalMetrics.pagesScraped,
    linksDiscovered: finalMetrics.linksDiscovered,
    errors: finalMetrics.errors,
    maxDepth: finalMetrics.currentDepth,
    duration,
  });

  return {
    jobId: '', // Will be set by job manager
    pagesScraped: finalMetrics.pagesScraped,
    linksDiscovered: finalMetrics.linksDiscovered,
    duration,
    errors,
    pages,
  };
}
