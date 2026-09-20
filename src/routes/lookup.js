import { validateBarcode } from '../barcode/validator.js';
import { lookupBarcode } from '../upstream/aggregator.js';
import { getCachedProductAnySource, saveProductToCache, logUsage } from '../db.js';
import { getMemory, setMemory } from '../cache.js';
import { config } from '../config.js';

const lookupSchema = {
  params: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 20 },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      sources: { type: 'string' },
      refresh: { type: 'string', enum: ['true', 'false'] },
    },
  },
};

const batchSchema = {
  body: {
    type: 'object',
    required: ['barcodes'],
    properties: {
      barcodes: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: { type: 'string', minLength: 1, maxLength: 20 },
      },
      sources: { type: 'array', items: { type: 'string' } },
    },
  },
};

export default async function lookupRoutes(fastify) {
  fastify.get('/barcode/:code', { schema: lookupSchema }, async (request, reply) => {
    const project = request.project;
    const code = request.params.code.trim();
    const startTime = Date.now();

    // 1. Validate the barcode format
    const validation = validateBarcode(code);
    if (!validation.valid) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid barcode',
        reason: validation.reason || 'check_digit_failed',
        barcode: code,
        detected_type: validation.type,
      });
    }

    const sources = request.query.sources
      ? request.query.sources.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const refresh = request.query.refresh === 'true';
    const memoryKey = `barcode:${code}`;

    // 2. Memory cache
    if (!refresh) {
      const mem = getMemory(memoryKey);
      if (mem) {
        const duration = Date.now() - startTime;
        logUsage(project.id, {
          endpoint: 'lookup',
          barcode: code,
          found: mem.found,
          cache_hit: 'memory',
          duration_ms: duration,
          client_ip: request.ip,
        });

        if (!mem.found) {
          return reply.status(404).send({
            success: false,
            error: 'Product not found',
            barcode: code,
            cache: 'memory',
            duration_ms: duration,
          });
        }

        return reply.send({
          success: true,
          barcode: code,
          barcode_type: validation.type,
          cache: 'memory',
          product: mem.product,
          duration_ms: duration,
        });
      }
    }

    // 3. SQLite cache
    if (!refresh) {
      const sqliteRow = getCachedProductAnySource(code);
      if (sqliteRow) {
        const product = JSON.parse(sqliteRow.product_data);
        setMemory(memoryKey, { found: true, product });

        const duration = Date.now() - startTime;
        logUsage(project.id, {
          endpoint: 'lookup',
          barcode: code,
          found: true,
          cache_hit: 'sqlite',
          upstream: sqliteRow.source,
          duration_ms: duration,
          client_ip: request.ip,
        });

        return reply.send({
          success: true,
          barcode: code,
          barcode_type: validation.type,
          cache: 'sqlite',
          source: sqliteRow.source,
          product,
          duration_ms: duration,
        });
      }
    }

    // 4. Upstream
    try {
      const result = await lookupBarcode(code, sources);
      const duration = Date.now() - startTime;

      if (!result.found) {
        // Negative cache
        saveProductToCache({
          barcode: code,
          barcode_type: validation.type,
          source: 'multi',
          found: false,
          product_data: JSON.stringify(null),
        });
        setMemory(memoryKey, { found: false, product: null });

        logUsage(project.id, {
          endpoint: 'lookup',
          barcode: code,
          found: false,
          cache_hit: 'miss',
          upstream_calls: result.upstream_calls,
          duration_ms: duration,
          client_ip: request.ip,
        });

        return reply.status(404).send({
          success: false,
          error: 'Product not found in any source',
          barcode: code,
          barcode_type: validation.type,
          cache: 'miss',
          upstream_calls: result.upstream_calls,
          duration_ms: duration,
        });
      }

      // Positive cache
      saveProductToCache({
        barcode: code,
        barcode_type: validation.type,
        source: result.source,
        found: true,
        product_data: JSON.stringify(result.product),
      });
      setMemory(memoryKey, { found: true, product: result.product });

      logUsage(project.id, {
        endpoint: 'lookup',
        barcode: code,
        found: true,
        cache_hit: 'miss',
        upstream: result.source,
        upstream_calls: result.upstream_calls,
        duration_ms: duration,
        client_ip: request.ip,
      });

      return reply.send({
        success: true,
        barcode: code,
        barcode_type: validation.type,
        cache: 'miss',
        source: result.source,
        upstream_calls: result.upstream_calls,
        product: result.product,
        duration_ms: duration,
      });
    } catch (error) {
      logUsage(project.id, {
        endpoint: 'lookup',
        barcode: code,
        found: false,
        cache_hit: 'miss',
        duration_ms: Date.now() - startTime,
        client_ip: request.ip,
      });
      return reply.status(500).send({ error: 'Lookup failed', details: error.message });
    }
  });

  // ─── Batch lookup ──────────────────────────────────────
  fastify.post('/barcode/batch', { schema: batchSchema }, async (request, reply) => {
    const project = request.project;
    const body = request.body;

    if (body.barcodes.length > config.limits.maxBatchSize) {
      return reply.status(400).send({
        error: `Batch size exceeds maximum of ${config.limits.maxBatchSize}`,
      });
    }

    const startTime = Date.now();
    const results = [];

    for (const code of body.barcodes) {
      const validation = validateBarcode(code);
      if (!validation.valid) {
        results.push({
          barcode: code,
          success: false,
          error: 'invalid_barcode',
          reason: validation.reason,
        });
        continue;
      }

      const memoryKey = `barcode:${code}`;
      const mem = getMemory(memoryKey);
      if (mem) {
        results.push({
          barcode: code,
          success: mem.found,
          cache: 'memory',
          product: mem.product,
        });
        continue;
      }

      const sqliteRow = getCachedProductAnySource(code);
      if (sqliteRow) {
        const product = JSON.parse(sqliteRow.product_data);
        setMemory(memoryKey, { found: true, product });
        results.push({
          barcode: code,
          success: true,
          cache: 'sqlite',
          source: sqliteRow.source,
          product,
        });
        continue;
      }

      const result = await lookupBarcode(code, body.sources);
      if (result.found) {
        saveProductToCache({
          barcode: code,
          barcode_type: validation.type,
          source: result.source,
          found: true,
          product_data: JSON.stringify(result.product),
        });
        setMemory(memoryKey, { found: true, product: result.product });
        results.push({
          barcode: code,
          success: true,
          cache: 'miss',
          source: result.source,
          product: result.product,
        });
      } else {
        results.push({
          barcode: code,
          success: false,
          error: 'not_found',
        });
      }
    }

    logUsage(project.id, {
      endpoint: 'lookup',
      query: `batch: ${body.barcodes.length}`,
      upstream_calls: results.filter((r) => r.cache === 'miss').length,
      duration_ms: Date.now() - startTime,
      client_ip: request.ip,
    });

    return reply.send({
      success: true,
      total: body.barcodes.length,
      found: results.filter((r) => r.success).length,
      duration_ms: Date.now() - startTime,
      results,
    });
  });
}
