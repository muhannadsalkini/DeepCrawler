/**
 * Job Manager
 * Manages crawl job lifecycle and storage
 */

import { Job, CrawlOptions } from '../types/crawl.js';
import { crawl } from '../crawler/engine.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export class JobManager {
  private jobs: Map<string, Job> = new Map();

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    return `job_${timestamp}_${random}`;
  }

  /**
   * Create a new crawl job
   */
  createJob(options: CrawlOptions): string {
    const jobId = this.generateJobId();

    const job: Job = {
      id: jobId,
      status: 'pending',
      startTime: Date.now(),
      options,
      metrics: {
        pagesScraped: 0,
        linksDiscovered: 0,
        errors: 0,
        currentDepth: 0,
      },
    };

    this.jobs.set(jobId, job);

    logger.info('Job created', { jobId, startUrl: options.startUrl });

    // Start crawl asynchronously
    this.executeCrawl(jobId);

    return jobId;
  }

  /**
   * Execute crawl job
   */
  private async executeCrawl(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error('Job not found for execution', new Error('Job not found'), { jobId });
      return;
    }

    try {
      // Update status to running
      job.status = 'running';
      this.jobs.set(jobId, job);

      logger.info('Job started', { jobId });

      // Execute crawl
      const result = await crawl(job.options);

      // Update job with result
      job.status = 'completed';
      job.endTime = Date.now();
      job.result = {
        ...result,
        jobId,
      };
      job.metrics = {
        pagesScraped: result.pagesScraped,
        linksDiscovered: result.linksDiscovered,
        errors: result.errors.length,
        currentDepth: 0, // Will be updated by crawler
      };

      this.jobs.set(jobId, job);

      logger.info('Job completed', {
        jobId,
        pagesScraped: result.pagesScraped,
        duration: result.duration,
      });
    } catch (error) {
      const err = error as Error;
      logger.error('Job failed', err, { jobId });

      job.status = 'failed';
      job.endTime = Date.now();
      job.error = err.message;

      this.jobs.set(jobId, job);
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    // Return job without full result to keep response light
    return {
      id: job.id,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      options: job.options,
      metrics: job.metrics,
      error: job.error,
    };
  }

  /**
   * Get job result
   */
  getJobResult(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Delete job
   */
  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clean up completed jobs older than specified time
   */
  cleanupOldJobs(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let deleted = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.endTime &&
        now - job.endTime > maxAgeMs
      ) {
        this.jobs.delete(jobId);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info('Cleaned up old jobs', { deleted });
    }

    return deleted;
  }
}

// Singleton instance
export const jobManager = new JobManager();
