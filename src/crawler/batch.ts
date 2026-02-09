/**
 * Batch Scraper
 * Processes multiple URLs concurrently with controlled concurrency
 */

import { fetch } from './fetcher.js';
import { parse } from './parser.js';
import { extractLinks } from './extractor.js';
import { normalizeUrl } from './normalizer.js';
import { PageData, CrawlError } from '../types/crawl.js';
import { logger } from '../utils/logger.js';
import { Timer } from '../utils/timer.js';

interface BatchScrapeOptions {
  urls: string[];
  concurrency?: number;
  timeout?: number;
  maxSize?: number;
  userAgent?: string;
}

interface BatchScrapeResult {
  results: PageData[];
  stats: {
    total: number;
    success: number;
    failed: number;
    duration: number;
  };
  errors: CrawlError[];
}

/**
 * Scrape a single URL and return PageData or error
 */
async function scrapeSingleUrl(
  url: string,
  options: {
    timeout: number;
    maxSize: number;
    userAgent: string;
  }
): Promise<{ success: true; data: PageData } | { success: false; error: CrawlError }> {
  try {
    const normalizedUrl = normalizeUrl(url);

    // Fetch HTML
    const fetchResult = await fetch(normalizedUrl, {
      timeout: options.timeout,
      maxSize: options.maxSize,
      userAgent: options.userAgent,
    });

    // Parse HTML
    const parsed = parse(fetchResult.html, normalizedUrl);

    // Extract links
    const links = extractLinks(parsed.links, normalizedUrl);

    const pageData: PageData = {
      url: normalizedUrl,
      title: parsed.title,
      text: parsed.text,
      links,
      depth: 0,
      scrapedAt: Date.now(),
      meta: parsed.meta,
    };

    return { success: true, data: pageData };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: {
        url,
        error: err.message,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Process URLs with controlled concurrency
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const executing = new Set<Promise<void>>();

  while (queue.length > 0 || executing.size > 0) {
    // Fill up to concurrency limit
    while (queue.length > 0 && executing.size < concurrency) {
      const item = queue.shift()!;

      const promise = processor(item)
        .then((result) => {
          results.push(result);
        })
        .finally(() => {
          executing.delete(promise);
        });

      executing.add(promise);
    }

    // Wait for at least one to complete
    if (executing.size > 0) {
      await Promise.race(executing);
    }
  }

  return results;
}

/**
 * Batch scrape multiple URLs concurrently
 */
export async function batchScrape(options: BatchScrapeOptions): Promise<BatchScrapeResult> {
  const timer = new Timer();
  const concurrency = options.concurrency ?? 5;
  const timeout = options.timeout ?? 10000;
  const maxSize = options.maxSize ?? 10485760;
  const userAgent = options.userAgent ?? 'DeepCrawler/1.0';

  logger.info('Batch scrape started', {
    urlCount: options.urls.length,
    concurrency,
  });

  // Process all URLs with concurrency control
  const scrapeOptions = { timeout, maxSize, userAgent };
  const allResults = await processWithConcurrency(
    options.urls,
    (url) => scrapeSingleUrl(url, scrapeOptions),
    concurrency
  );

  // Separate successes and failures
  const results: PageData[] = [];
  const errors: CrawlError[] = [];

  for (const result of allResults) {
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  const duration = timer.elapsed();

  const batchResult: BatchScrapeResult = {
    results,
    stats: {
      total: options.urls.length,
      success: results.length,
      failed: errors.length,
      duration,
    },
    errors,
  };

  logger.info('Batch scrape completed', {
    total: batchResult.stats.total,
    success: batchResult.stats.success,
    failed: batchResult.stats.failed,
    duration,
  });

  return batchResult;
}
