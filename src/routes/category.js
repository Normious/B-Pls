import { browseByCategory, logUsage } from '../db.js';
import { config } from '../config.js';

export default async function categoryRoutes(fastify) {
  fastify.get('/category/:cat', async (request, reply) => {
    const project = request.project;
    const startTime = Date.now();
    const cat = (request.params.cat || '').trim();

    if (!cat) {
      return reply.status(400).send({ success: false, error: 'Missing category' });
    }

    const limit = Math.min(
      parseInt(request.query.limit || String(config.limits.defaultSearchLimit)),
      config.limits.maxSearchLimit
    );
    const offset = Math.max(parseInt(request.query.offset || '0'), 0);

    const { rows, total } = browseByCategory(cat, limit, offset);
    const results = rows.map((r) => {
      try {
        return JSON.parse(r.product_data);
      } catch {
        return null;
      }
    }).filter(Boolean);

    logUsage(project.id, {
      endpoint: 'category',
      query: cat,
      found: results.length > 0,
      cache_hit: 'sqlite',
      duration_ms: Date.now() - startTime,
      client_ip: request.ip,
    });

    return reply.send({
      success: true,
      category: cat,
      total,
      limit,
      offset,
      count: results.length,
      results,
      duration_ms: Date.now() - startTime,
    });
  });
}
