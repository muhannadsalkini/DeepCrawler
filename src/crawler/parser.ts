/**
 * HTML Parser using Cheerio
 * Extracts structured data from HTML content
 */

import * as cheerio from 'cheerio';
import { ParsedPage } from '../types/crawl.js';
import { logger } from '../utils/logger.js';

export function parse(html: string, url: string): ParsedPage {
  try {
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $('title').first().text().trim() ||
      $('h1').first().text().trim() ||
      'No title';

    // Extract meta description
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim();

    // Extract meta keywords
    const keywordsContent = $('meta[name="keywords"]').attr('content');
    const keywords = keywordsContent
      ? keywordsContent
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      : undefined;

    // Extract text content (exclude scripts, styles, and hidden elements)
    $('script, style, noscript, svg').remove();
    const text = $('body')
      .text()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .slice(0, 10000); // Limit to first 10k characters

    // Extract all links
    const links: string[] = [];
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        links.push(href);
      }
    });

    logger.debug('Parse successful', { url, titleLength: title.length, linksCount: links.length });

    return {
      title,
      text,
      links,
      meta: {
        description,
        keywords,
      },
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Parse failed', err, { url });
    throw new Error(`Failed to parse HTML: ${err.message}`);
  }
}
