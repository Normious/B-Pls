import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import pino from 'pino';

import { config } from './config.js';
import { getDatabase } from './db.js';
import { authenticate } from './middleware/auth.js';
import lookupRoutes from './routes/lookup.js';
import validateRoutes from './routes/validate.js';
import searchRoutes from './routes/search.js';
import categoryRoutes from './routes/category.js';
import statsRoutes from './routes/stats.js';

const fastify = Fastify({
  logger: pino({
    level: config.logLevel,
    transport: config.nodeEnv !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  }),
});

await fastify.register(cors, { origin: true });
await fastify.register(helmet, { contentSecurityPolicy: false });

getDatabase();
fastify.log.info('✅ Database initialized');

fastify.register(async (instance) => {
  instance.addHook('preHandler', authenticate);
  instance.register(lookupRoutes);
  instance.register(validateRoutes);
  instance.register(searchRoutes);
  instance.register(categoryRoutes);
  instance.register(statsRoutes);
});

fastify.get('/health', async () => ({
  service: 'B-Pls — Barcode Lookup Service',
  version: '1.0.0',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

fastify.get('/', async () => ({
  service: 'B-Pls',
  description: 'Barcode/product lookup service',
  version: '1.0.0',
  endpoints: {
    'GET /barcode/:code': 'Look up a product by barcode',
    'POST /barcode/batch': 'Batch lookup up to 50 barcodes',
    'GET /barcode/validate/:code': 'Validate a barcode check digit',
    'GET /search?q=': 'Search cached products by name',
    'GET /category/:cat': 'Browse cached products by category',
    'GET /stats': 'Cache hit metrics and analytics',
    'GET /health': 'Health check',
  },
  sources: [
    'Open Food Facts (food)',
    'Open Beauty Facts (cosmetics)',
    'Open Pet Food Facts (pet food)',
    'Open Products Facts (general)',
    'Open Library (books by ISBN)',
  ],
  barcode_types: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'ISBN-10', 'ISBN-13'],
}));

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`🚀 B-Pls running on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => { await fastify.close(); process.exit(0); });
process.on('SIGTERM', async () => { await fastify.close(); process.exit(0); });

start();
export default fastify;
