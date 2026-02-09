/**
 * HTTP Fetcher using Undici
 * Downloads HTML content from URLs with safety limits
 */

import { request } from 'undici';
import { FetchOptions, FetchResult } from '../types/crawl.js';
import { logger } from '../utils/logger.js';

const DEFAULT_USER_AGENT = 'DeepCrawler/1.0 (+https://github.com/deepcrawler)';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function fetch(
  url: string,
  options?: Partial<FetchOptions>
): Promise<FetchResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;

  try {
    logger.debug('Fetching URL', { url, timeout, maxSize });

    const response = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      headersTimeout: timeout,
      bodyTimeout: timeout,
      maxRedirections: 5,
    });

    const { statusCode, headers } = response;
    const contentType = (headers['content-type'] as string) || '';

    // Check if response is HTML
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Non-HTML content type: ${contentType}`);
    }

    // Read body with size limit
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of response.body) {
      totalSize += chunk.length;

      if (totalSize > maxSize) {
        throw new Error(`Response size exceeds limit: ${maxSize} bytes`);
      }

      chunks.push(chunk);
    }

    const html = Buffer.concat(chunks).toString('utf-8');

    logger.debug('Fetch successful', { url, statusCode, size: totalSize });

    return {
      url,
      statusCode,
      html,
      contentType,
      size: totalSize,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Fetch failed', err, { url });
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}
