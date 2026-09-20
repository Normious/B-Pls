import { getProjectByApiKey } from '../db.js';

export async function authenticate(request, reply) {
  const apiKey = request.headers['x-api-key'];
  if (!apiKey) return reply.status(401).send({ error: 'Missing X-API-Key header' });

  const project = getProjectByApiKey(apiKey);
  if (!project) return reply.status(401).send({ error: 'Invalid or inactive API Key' });

  request.project = project;
}
