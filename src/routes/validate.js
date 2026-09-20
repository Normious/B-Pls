import { validateBarcode } from '../barcode/validator.js';

export default async function validateRoutes(fastify) {
  fastify.get('/barcode/validate/:code', async (request, reply) => {
    const code = request.params.code.trim();
    const result = validateBarcode(code);

    return reply.send({
      success: true,
      barcode: code,
      valid: result.valid,
      type: result.type,
      normalized: result.normalized,
      reason: result.reason || null,
    });
  });
}
