import Fastify from 'fastify';
import { logger } from './utils/logger.js';
import { scrapeRoutes } from './api/routes/scrape.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

export async function build() {
  const fastify = Fastify({
    logger: false, // Using custom logger
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  });

  // Register API routes
  await fastify.register(scrapeRoutes);

  return fastify;
}

async function start() {
  try {
    const server = await build();

    await server.listen({ port: PORT, host: HOST });

    logger.info('Server started successfully', {
      port: PORT,
      host: HOST,
      env: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    logger.error('Failed to start server', err as Error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
