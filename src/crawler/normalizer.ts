/**
 * URL Normalizer
 * Ensures URLs are consistent and deduplicated
 */

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Convert to lowercase
    urlObj.hostname = urlObj.hostname.toLowerCase();
    urlObj.protocol = urlObj.protocol.toLowerCase();

    // Remove trailing slash from pathname (except for root)
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    // Remove default ports
    if (
      (urlObj.protocol === 'http:' && urlObj.port === '80') ||
      (urlObj.protocol === 'https:' && urlObj.port === '443')
    ) {
      urlObj.port = '';
    }

    // Sort query parameters
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      const sortedParams = new URLSearchParams(
        Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      );
      urlObj.search = sortedParams.toString();
    }

    // Remove fragment
    urlObj.hash = '';

    return urlObj.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    const resolved = new URL(relativeUrl, baseUrl);
    return normalizeUrl(resolved.toString());
  } catch (error) {
    throw new Error(`Failed to resolve URL: ${relativeUrl} against ${baseUrl}`);
  }
}

/**
 * Check if URL is valid HTTP(S)
 */
export function isValidHttpUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Check if two URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  try {
    return getDomain(url1) === getDomain(url2);
  } catch {
    return false;
  }
}
