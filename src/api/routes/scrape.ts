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
      // Validation schema for batch request
      const BatchScrapeRequestSchema = z.object({
        urls: z.array(z.string().url('Invalid URL format')).min(1, 'At least one URL required'),
        concurrency: z.number().min(1).max(20).optional(),
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
