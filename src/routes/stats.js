import { getStats } from '../db.js';
import { getCacheStats } from '../cache.js';

export default async function statsRoutes(fastify) {
  fastify.get('/stats', async (request) => {
    const project = request.project;
    const days = Math.min(parseInt(request.query.days || '30'), 365);

    const stats = getStats(project.id, days);

    return {
      success: true,
      ...stats,
      memory_cache: getCacheStats(),
    };
  });
}
