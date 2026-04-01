/**
 * API Key Authentication Middleware
 *
 * Enforces API key validation on every request except the /health endpoint.
 * The key is read from the `x-api-key` request header and compared against
 * the `API_KEY` environment variable using a constant-time comparison to
 * prevent timing-based side-channel attacks.
 *
 * Behaviour:
 *  - If `API_KEY` env var is not set  → 503 Service Unavailable (fail-closed)
 *  - If header is missing or wrong    → 401 Unauthorized
 *  - If header matches `API_KEY`      → request proceeds normally
 *
 * Usage:
 *   await fastify.register(authPlugin);   // register BEFORE route plugins
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Constant-time string comparison to prevent timing-based key enumeration.
 * Returns true only when both strings are identical in length and content.
 */
function safeCompare(a: string, b: string): boolean {
  // Pad both to the same length so Buffer.byteLength is always equal,
  // which is required by timingSafeEqual.
  const aBytes = Buffer.from(a, 'utf8');
  const bBytes = Buffer.from(b, 'utf8');

  // If lengths differ, fill bBytes with a dummy value of the same length as aBytes
  // so timingSafeEqual can run, but we still return false.
  if (aBytes.length !== bBytes.length) {
    // Still run timingSafeEqual on same-sized buffers to avoid early returns
    // leaking length information via timing.
    const dummy = Buffer.alloc(aBytes.length);
    timingSafeEqual(aBytes, dummy);
    return false;
  }

  return timingSafeEqual(aBytes, bBytes);
}

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // ── Always allow health-check without authentication ─────────────────
      if (request.url === '/health') {
        return;
      }

      const configuredKey = process.env.API_KEY;

      // ── Fail-closed: refuse all traffic if the key is not configured ─────
      if (!configuredKey || configuredKey.trim() === '') {
        logger.warn('API_KEY environment variable is not set — denying all requests', {
          url: request.url,
          method: request.method,
          ip: request.ip,
        });

        return reply.status(503).send({
          error: 'Service unavailable',
          message: 'The API is not properly configured. Contact the administrator.',
        });
      }

      // ── Extract key from header ───────────────────────────────────────────
      const providedKey = request.headers['x-api-key'];

      if (!providedKey || typeof providedKey !== 'string') {
        logger.warn('Missing x-api-key header', {
          url: request.url,
          method: request.method,
          ip: request.ip,
        });

        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing required x-api-key header.',
        });
      }

      // ── Constant-time comparison ─────────────────────────────────────────
      if (!safeCompare(providedKey, configuredKey)) {
        logger.warn('Invalid API key provided', {
          url: request.url,
          method: request.method,
          ip: request.ip,
        });

        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key.',
        });
      }
    }
  );
}
