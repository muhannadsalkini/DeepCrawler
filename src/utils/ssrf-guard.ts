/**
 * SSRF Guard Utility
 *
 * Protects against Server-Side Request Forgery (SSRF) attacks by:
 * 1. Blocking known private/reserved hostnames directly
 * 2. Resolving the hostname via DNS and rejecting any IP that falls
 *    within a private, loopback, link-local, or cloud-metadata range
 *
 * This allows the crawler to reach every public internet site while
 * preventing requests to internal infrastructure (databases, cloud
 * metadata APIs, internal admin panels, etc.).
 *
 * Mitigates: VULN-001, VULN-006, VULN-007, VULN-018
 */

import dns from 'dns/promises';
import { URL } from 'url';

// ────────────────────────────────────────────────────────────────────────────
// Immediately-rejected hostnames (no DNS lookup needed)
// ────────────────────────────────────────────────────────────────────────────
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  // IPv4-mapped loopback in IPv6 notation
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
]);

// ────────────────────────────────────────────────────────────────────────────
// Private / reserved IPv4 ranges (CIDR notation for documentation)
//
//  127.0.0.0/8      — Loopback
//  10.0.0.0/8       — RFC 1918 private
//  172.16.0.0/12    — RFC 1918 private  (172.16.x.x – 172.31.x.x)
//  192.168.0.0/16   — RFC 1918 private
//  169.254.0.0/16   — Link-local / cloud metadata (AWS: 169.254.169.254)
//  0.0.0.0/8        — "This" network
//  100.64.0.0/10    — Shared address space (AWS internal, carrier-grade NAT)
//  192.0.0.0/24     — IETF protocol assignments
//  192.0.2.0/24     — TEST-NET-1 (documentation)
//  198.51.100.0/24  — TEST-NET-2 (documentation)
//  203.0.113.0/24   — TEST-NET-3 (documentation)
//  240.0.0.0/4      — Reserved (class E)
// ────────────────────────────────────────────────────────────────────────────
const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^127\./,                                       // 127.0.0.0/8  loopback
  /^10\./,                                        // 10.0.0.0/8   RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,                  // 172.16.0.0/12 RFC 1918
  /^192\.168\./,                                  // 192.168.0.0/16 RFC 1918
  /^169\.254\./,                                  // 169.254.0.0/16 link-local / cloud metadata
  /^0\./,                                         // 0.0.0.0/8    "this" network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,   // 100.64.0.0/10 shared address space
  /^192\.0\.0\./,                                 // 192.0.0.0/24 IETF protocol
  /^192\.0\.2\./,                                 // 192.0.2.0/24 TEST-NET-1
  /^198\.51\.100\./,                              // 198.51.100.0/24 TEST-NET-2
  /^203\.0\.113\./,                               // 203.0.113.0/24 TEST-NET-3
  /^(2[4-5]\d|240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255)\./,  // 240.0.0.0/4 reserved
];

// ────────────────────────────────────────────────────────────────────────────
// Private / reserved IPv6 ranges
//
//  ::1/128          — Loopback
//  fc00::/7         — Unique local (fd00:: and fc00::)
//  fe80::/10        — Link-local
//  ::ffff:0:0/96    — IPv4-mapped (disguised IPv4 private addresses)
// ────────────────────────────────────────────────────────────────────────────
const PRIVATE_IPV6_PATTERNS: RegExp[] = [
  /^::1$/i,                    // ::1 loopback
  /^fc[0-9a-f]{2}:/i,          // fc00::/7 unique local
  /^fd[0-9a-f]{2}:/i,          // fd00::/8 unique local
  /^fe[89ab][0-9a-f]:/i,       // fe80::/10 link-local
  /^::ffff:/i,                  // ::ffff:0:0/96 IPv4-mapped IPv6
  /^64:ff9b::/i,                // 64:ff9b::/96 IPv4/IPv6 translation
];

/**
 * Returns true if the given IP address (v4 or v6) is in a private,
 * reserved, or otherwise non-routable range.
 */
export function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();

  // Try IPv4 patterns first
  for (const pattern of PRIVATE_IPV4_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  // Try IPv6 patterns
  for (const pattern of PRIVATE_IPV6_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  return false;
}

/**
 * Validates that a URL is safe to fetch — i.e., it does not target
 * internal infrastructure.
 *
 * Steps:
 *  1. Parse and validate the URL structure
 *  2. Enforce HTTP or HTTPS protocol only
 *  3. Reject known private/loopback hostnames immediately
 *  4. Resolve the hostname via DNS
 *  5. Reject if any resolved IP is in a private/reserved range
 *
 * @throws {Error} if the URL is unsafe or cannot be validated
 */
export async function assertSafeUrl(url: string): Promise<void> {
  // ── Step 1: Parse URL ──────────────────────────────────────────────────────
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    throw new Error(`SSRF guard: invalid URL "${url}"`);
  }

  // ── Step 2: Protocol allow-list ───────────────────────────────────────────
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new Error(
      `SSRF guard: disallowed protocol "${urlObj.protocol}" in URL "${url}". Only http and https are permitted.`
    );
  }

  const hostname = urlObj.hostname.toLowerCase();

  // ── Step 3: Immediate hostname blocklist ──────────────────────────────────
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`SSRF guard: blocked hostname "${hostname}"`);
  }

  // ── Step 4: Resolve DNS ───────────────────────────────────────────────────
  let resolvedAddresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    resolvedAddresses = results.map((r) => r.address);
  } catch (err) {
    // If DNS resolution fails we fail-closed: deny the request.
    // An attacker cannot bypass this by using an unresolvable hostname.
    throw new Error(
      `SSRF guard: DNS resolution failed for "${hostname}": ${(err as Error).message}`
    );
  }

  if (resolvedAddresses.length === 0) {
    throw new Error(`SSRF guard: no addresses resolved for "${hostname}"`);
  }

  // ── Step 5: Validate every resolved IP ───────────────────────────────────
  for (const addr of resolvedAddresses) {
    if (isPrivateIp(addr)) {
      throw new Error(
        `SSRF guard: "${hostname}" resolves to private/reserved IP "${addr}". Request blocked.`
      );
    }
  }
}
