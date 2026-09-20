import { searchCachedProducts, logUsage } from '../db.js';
import { config } from '../config.js';

export default async function searchRoutes(fastify) {
  fastify.get('/search', async (request, reply) => {
    const project = request.project;
    const startTime = Date.now();
    const q = (request.query.q || '').trim();

    if (!q) {
      return reply.status(400).send({ success: false, error: 'Missing ?q= query' });
    }

    const limit = Math.min(
      parseInt(request.query.limit || String(config.limits.defaultSearchLimit)),
      config.limits.maxSearchLimit
    );
    const offset = Math.max(parseInt(request.query.offset || '0'), 0);

    const { rows, total } = searchCachedProducts(q, limit, offset);
    const results = rows.map((r) => {
      try {
        return JSON.parse(r.product_data);
      } catch {
        return null;
      }
    }).filter(Boolean);

    logUsage(project.id, {
      endpoint: 'search',
      query: q,
      found: results.length > 0,
      cache_hit: 'sqlite',
      duration_ms: Date.now() - startTime,
      client_ip: request.ip,
    });

    return reply.send({
      success: true,
      query: q,
      total,
      limit,
      offset,
      count: results.length,
      results,
      duration_ms: Date.now() - startTime,
    });
  });
}
