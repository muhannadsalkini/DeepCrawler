// Core crawl types
export interface CrawlOptions {
  startUrl: string;
  strategy: 'domain' | 'all';
  maxDepth: number;
  maxPages: number;
  concurrency: number;
  timeout: number;
}

export interface CrawlResult {
  jobId: string;
  pagesScraped: number;
  linksDiscovered: number;
  duration: number;
  errors: CrawlError[];
  pages: PageData[];
}

export interface PageData {
  url: string;
  title: string;
  text: string;
  links: string[];
  depth: number;
  scrapedAt: number;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface CrawlError {
  url: string;
  error: string;
  timestamp: number;
}

// Job management types
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  startTime: number;
  endTime?: number;
  options: CrawlOptions;
  metrics: JobMetrics;
  result?: CrawlResult;
  error?: string;
}

export interface JobMetrics {
  pagesScraped: number;
  linksDiscovered: number;
  errors: number;
  currentDepth: number;
}

// Queue types
export interface QueueItem {
  url: string;
  depth: number;
  parentUrl?: string;
}

// Fetcher types
export interface FetchOptions {
  timeout: number;
  maxSize: number;
  userAgent: string;
}

export interface FetchResult {
  url: string;
  statusCode: number;
  html: string;
  contentType: string;
  size: number;
}

// Parser types
export interface ParsedPage {
  title: string;
  text: string;
  links: string[];
  meta: {
    description?: string;
    keywords?: string[];
  };
}
