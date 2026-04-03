/**
 * Scrape API Route
 * Handles single URL scraping requests
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { fetch } from '../../crawler/fetcher.js';
import { parse } from '../../crawler/parser.js';
import { extractLinks } from '../../crawler/extractor.js';
import { normalizeUrl } from '../../crawler/normalizer.js';
import { assertSafeUrl } from '../../utils/ssrf-guard.js';
import { logger } from '../../utils/logger.js';

// Request validation schema
const ScrapeRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

export async function scrapeRoutes(fastify: FastifyInstance): Promise<void> {
  // Single URL scrape endpoint
  fastify.post('/api/scrape', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      const validation = ScrapeRequestSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const { url } = validation.data as ScrapeRequest;

      logger.info('Scrape request received', { url });

      // Normalize URL
      const normalizedUrl = normalizeUrl(url);

      // ── SSRF guard: reject private/internal URLs before fetching ──────────
      await assertSafeUrl(normalizedUrl);

      // Fetch HTML
      const fetchResult = await fetch(normalizedUrl, {
        timeout: parseInt(process.env.DEFAULT_TIMEOUT || '10000', 10),
        maxSize: parseInt(process.env.MAX_RESPONSE_SIZE || '10485760', 10),
        userAgent: process.env.USER_AGENT || 'DeepCrawler/1.0',
      });

      // Parse HTML
      const parsed = parse(fetchResult.html, normalizedUrl);

      // Extract and normalize links
      const links = extractLinks(parsed.links, normalizedUrl);

      // Build response
      const response = {
        url: normalizedUrl,
        title: parsed.title,
        text: parsed.text,
        links,
        meta: parsed.meta,
      };

      logger.info('Scrape completed successfully', {
        url: normalizedUrl,
        linksFound: links.length,
      });

      return reply.status(200).send(response);
    } catch (error) {
      const err = error as Error;
      logger.error('Scrape failed', err, {
        url: (request.body as ScrapeRequest)?.url,
      });

      return reply.status(500).send({
        error: 'Failed to scrape URL',
        message: err.message,
      });
    }
  });

  // Batch URL scrape endpoint
  fastify.post('/api/scrape/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // enforce upper bound on URL array and concurrency
      const MAX_BATCH_URLS = parseInt(process.env.MAX_BATCH_URLS || '50', 10);

      // Validation schema for batch request
      const BatchScrapeRequestSchema = z.object({
        urls: z
          .array(z.string().url('Invalid URL format'))
          .min(1, 'At least one URL required')
          .max(MAX_BATCH_URLS, `Maximum ${MAX_BATCH_URLS} URLs per batch request`),
        concurrency: z.number().min(1).max(10).optional(), // capped at 10 (was 20)
      });

      const validation = BatchScrapeRequestSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const { urls, concurrency } = validation.data;

      logger.info('Batch scrape request received', { urlCount: urls.length, concurrency });

      // ── SSRF guard: validate every URL before dispatching the batch ───────
      // We validate all URLs upfront so we fail fast with a clear error
      // rather than letting safe URLs succeed while blocked ones error mid-batch.
      const ssrfErrors: string[] = [];
      await Promise.all(
        urls.map(async (rawUrl) => {
          try {
            const normalized = normalizeUrl(rawUrl);
            await assertSafeUrl(normalized);
          } catch (err) {
            ssrfErrors.push(`${rawUrl}: ${(err as Error).message}`);
          }
        })
      );

      if (ssrfErrors.length > 0) {
        return reply.status(400).send({
          error: 'One or more URLs failed the SSRF safety check',
          blocked: ssrfErrors,
        });
      }

      // Import batch scraper
      const { batchScrape } = await import('../../crawler/batch.js');

      // Execute batch scrape
      const result = await batchScrape({
        urls,
        concurrency: concurrency ?? parseInt(process.env.DEFAULT_CONCURRENCY || '5', 10),
        timeout: parseInt(process.env.DEFAULT_TIMEOUT || '10000', 10),
        maxSize: parseInt(process.env.MAX_RESPONSE_SIZE || '10485760', 10),
        userAgent: process.env.USER_AGENT || 'DeepCrawler/1.0',
      });

      logger.info('Batch scrape completed', {
        total: result.stats.total,
        success: result.stats.success,
        failed: result.stats.failed,
      });

      return reply.status(200).send(result);
    } catch (error) {
      const err = error as Error;
      logger.error('Batch scrape failed', err);

      return reply.status(500).send({
        error: 'Failed to process batch scrape',
        message: err.message,
      });
    }
  });
}
