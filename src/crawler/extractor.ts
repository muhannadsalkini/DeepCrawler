/**
 * Link Extractor
 * Discovers, normalizes, and filters links from HTML
 */

import { normalizeUrl, resolveUrl, isValidHttpUrl } from './normalizer.js';
import { logger } from '../utils/logger.js';

/**
 * Extract and normalize links from raw href attributes
 */
export function extractLinks(rawLinks: string[], baseUrl: string): string[] {
  const uniqueLinks = new Set<string>();

  for (const href of rawLinks) {
    try {
      // Skip empty or invalid hrefs
      if (!href || href.trim().length === 0) {
        continue;
      }

      const trimmedHref = href.trim();

      // Skip non-HTTP protocols
      if (
        trimmedHref.startsWith('mailto:') ||
        trimmedHref.startsWith('tel:') ||
        trimmedHref.startsWith('javascript:') ||
        trimmedHref.startsWith('data:') ||
        trimmedHref.startsWith('#')
      ) {
        continue;
      }

      // Resolve relative URLs
      const absoluteUrl = resolveUrl(baseUrl, trimmedHref);

      // Validate HTTP(S)
      if (!isValidHttpUrl(absoluteUrl)) {
        continue;
      }

      // Skip self-references
      const normalizedBase = normalizeUrl(baseUrl);
      if (absoluteUrl === normalizedBase) {
        continue;
      }

      uniqueLinks.add(absoluteUrl);
    } catch (error) {
      // Skip invalid URLs
      logger.debug('Skipping invalid link', { href, error: (error as Error).message });
      continue;
    }
  }

  const links = Array.from(uniqueLinks);
  logger.debug('Extract links complete', { baseUrl, found: rawLinks.length, valid: links.length });

  return links;
}

/**
 * Filter links by domain restriction
 */
export function filterByDomain(links: string[], allowedDomain: string): string[] {
  return links.filter((link) => {
    try {
      const linkDomain = new URL(link).hostname;
      return linkDomain === allowedDomain;
    } catch {
      return false;
    }
  });
}
