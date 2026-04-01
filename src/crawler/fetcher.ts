/**
 * HTTP Fetcher using Undici
 * Downloads HTML content from URLs with safety limits
 *
 * Security:
 *  - All URLs (including redirect targets) are validated through the SSRF
 *    guard before a connection is made (fixes VULN-001 & VULN-006).
 *  - Automatic redirect following is disabled; each hop is re-validated.
 *  - Redirect depth is capped at MAX_REDIRECTS to prevent infinite loops.
 */

import { request } from 'undici';
import { FetchOptions, FetchResult } from '../types/crawl.js';
import { assertSafeUrl } from '../utils/ssrf-guard.js';
import { logger } from '../utils/logger.js';

const DEFAULT_USER_AGENT = 'DeepCrawler/1.0 (+https://github.com/deepcrawler)';
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_REDIRECTS = 5; // Maximum redirect hops allowed

export async function fetch(
  url: string,
  options?: Partial<FetchOptions>,
  _redirectDepth = 0
): Promise<FetchResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;

  // ── SSRF guard: validate this URL (and every redirect target) ─────────────
  // This runs on the initial request AND on every redirect hop, so a public
  // URL that redirects to an internal address is still blocked.
  await assertSafeUrl(url);

  // ── Redirect depth cap ────────────────────────────────────────────────────
  if (_redirectDepth > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS}) for URL: ${url}`);
  }

  try {
    logger.debug('Fetching URL', { url, timeout, maxSize, redirectDepth: _redirectDepth });

    const response = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      headersTimeout: timeout,
      bodyTimeout: timeout,
      maxRedirections: 0, // ✅ Disable automatic redirect following — we handle it manually
    });

    const { statusCode, headers } = response;

    // ── Manual redirect handling with per-hop SSRF validation ─────────────
    if (statusCode >= 300 && statusCode < 400) {
      const location = headers['location'] as string | undefined;

      if (!location) {
        throw new Error(`Redirect response (${statusCode}) has no Location header`);
      }

      // Resolve relative redirect targets against the current URL
      let redirectUrl: string;
      try {
        redirectUrl = new URL(location, url).toString();
      } catch {
        throw new Error(`Invalid redirect Location header: "${location}"`);
      }

      logger.debug('Following redirect', {
        from: url,
        to: redirectUrl,
        statusCode,
        hop: _redirectDepth + 1,
      });

      // Recursively fetch the redirect target — assertSafeUrl runs again at the top
      return fetch(redirectUrl, options, _redirectDepth + 1);
    }

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
