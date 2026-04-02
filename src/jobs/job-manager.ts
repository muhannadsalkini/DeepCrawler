/**
 * Job Manager
 * Manages crawl job lifecycle and storage
 *
 * Unbounded In-Memory Job Growth (VULN-004 — fixed):
 *  - MAX_JOBS: hard cap on total stored jobs (active + completed/failed).
 *    createJob() throws when the cap is reached, preventing unbounded growth.
 *  - Automatic cleanup: a setInterval fires every JOB_CLEANUP_INTERVAL_MS
 *    to evict completed/failed jobs older than JOB_TTL_MS, keeping the
 *    in-memory map bounded even under sustained load.
 *
 * No Concurrent Job Limit (VULN-005 — fixed):
 *  - MAX_CONCURRENT_JOBS: hard cap on jobs whose status is 'pending' or
 *    'running'. createJob() throws (→ HTTP 429) when this limit is reached,
 *    preventing resource exhaustion from simultaneous crawls.
 */

import { Job, CrawlOptions } from '../types/crawl.js';
import { crawl } from '../crawler/engine.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// configurable via environment variables
const MAX_JOBS = parseInt(process.env.MAX_JOBS || '200', 10);
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '5', 10);
const JOB_TTL_MS = parseInt(process.env.JOB_TTL_MS || '3600000', 10); // default 1 hour
const JOB_CLEANUP_INTERVAL_MS = parseInt(
  process.env.JOB_CLEANUP_INTERVAL_MS || '300000', // default every 5 minutes
  10
);

export class JobManager {
  private jobs: Map<string, Job> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Automatic periodic cleanup
    // Runs on a fixed interval to evict completed/failed jobs older than
    // JOB_TTL_MS, preventing unbounded heap growth over time.
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs(JOB_TTL_MS);
    }, JOB_CLEANUP_INTERVAL_MS);

    // Allow Node.js to exit cleanly even if the timer is still active
    // (prevents the timer from keeping the process alive in tests/scripts).
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    logger.info('JobManager initialised', {
      maxJobs: MAX_JOBS,
      maxConcurrentJobs: MAX_CONCURRENT_JOBS,
      jobTtlMs: JOB_TTL_MS,
      cleanupIntervalMs: JOB_CLEANUP_INTERVAL_MS,
    });
  }

  /**
   * Stop the background cleanup timer (useful in tests / graceful shutdown).
   */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }

  /**
   * Count jobs that are currently active (pending or running).
   */
  private getActiveJobCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' || job.status === 'running') {
        count++;
      }
    }
    return count;
  }

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
    // ── VULN-004: enforce hard cap on total stored jobs ───────────────────
    if (this.jobs.size >= MAX_JOBS) {
      logger.warn('Job limit reached, rejecting new job', {
        currentJobs: this.jobs.size,
        maxJobs: MAX_JOBS,
      });
      throw new Error(
        `Job limit reached. The server is already tracking ${this.jobs.size} jobs ` +
          `(maximum ${MAX_JOBS}). Wait for existing jobs to complete or increase MAX_JOBS.`
      );
    }

    // ── VULN-005: enforce cap on simultaneously active (pending/running) jobs
    const activeCount = this.getActiveJobCount();
    if (activeCount >= MAX_CONCURRENT_JOBS) {
      logger.warn('Concurrent job limit reached, rejecting new job', {
        activeJobs: activeCount,
        maxConcurrentJobs: MAX_CONCURRENT_JOBS,
      });
      throw new Error(
        `Too many active jobs. ${activeCount} jobs are currently pending or running ` +
          `(maximum ${MAX_CONCURRENT_JOBS}). Wait for a job to finish before submitting a new one.`
      );
    }

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
