/**
 * Crawl API Routes
 * Handles crawl job creation and status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { jobManager } from '../../jobs/job-manager.js';
import { logger } from '../../utils/logger.js';

// Crawl request validation schema
const CrawlRequestSchema = z.object({
  startUrl: z.string().url('Invalid URL format'),
  strategy: z.enum(['domain', 'all']).optional().default('domain'),
  maxDepth: z.number().min(1).max(10).optional().default(3),
  maxPages: z.number().min(1).max(1000).optional().default(100),
  concurrency: z.number().min(1).max(20).optional().default(5),
  timeout: z.number().min(1000).max(60000).optional().default(10000),
});

type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export async function crawlRoutes(fastify: FastifyInstance): Promise<void> {
  // Start crawl job
  fastify.post('/api/crawl', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = CrawlRequestSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const options = validation.data as CrawlRequest;

      logger.info('Crawl job request received', {
        startUrl: options.startUrl,
        strategy: options.strategy,
      });

      // Create job
      const jobId = jobManager.createJob(options);

      return reply.status(202).send({
        jobId,
        status: 'pending',
        message: 'Crawl job created successfully',
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to create crawl job', err);

      return reply.status(500).send({
        error: 'Failed to create crawl job',
        message: err.message,
      });
    }
  });

  // Get job status
  fastify.get('/api/crawl/:jobId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      const job = jobManager.getJobStatus(jobId);

      if (!job) {
        return reply.status(404).send({
          error: 'Job not found',
        });
      }

      // Format response based on status
      if (job.status === 'pending') {
        return reply.status(200).send({
          jobId: job.id,
          status: job.status,
          createdAt: job.startTime,
        });
      }

      if (job.status === 'running') {
        return reply.status(200).send({
          jobId: job.id,
          status: job.status,
          createdAt: job.startTime,
          metrics: job.metrics,
        });
      }

      if (job.status === 'completed') {
        return reply.status(200).send({
          jobId: job.id,
          status: job.status,
          createdAt: job.startTime,
          completedAt: job.endTime,
          metrics: job.metrics,
        });
      }

      if (job.status === 'failed') {
        return reply.status(200).send({
          jobId: job.id,
          status: job.status,
          createdAt: job.startTime,
          failedAt: job.endTime,
          error: job.error,
        });
      }

      return reply.status(200).send(job);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get job status', err);

      return reply.status(500).send({
        error: 'Failed to get job status',
        message: err.message,
      });
    }
  });

  // Get job result
  fastify.get('/api/crawl/:jobId/result', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { jobId } = request.params as { jobId: string };

      const job = jobManager.getJobResult(jobId);

      if (!job) {
        return reply.status(404).send({
          error: 'Job not found',
        });
      }

      if (job.status !== 'completed') {
        return reply.status(409).send({
          error: `Job is ${job.status}. Results only available for completed jobs.`,
          currentStatus: job.status,
        });
      }

      return reply.status(200).send({
        jobId: job.id,
        status: job.status,
        startUrl: job.options.startUrl,
        strategy: job.options.strategy,
        metrics: job.metrics,
        result: job.result,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to get job result', err);

      return reply.status(500).send({
        error: 'Failed to get job result',
        message: err.message,
      });
    }
  });
}
