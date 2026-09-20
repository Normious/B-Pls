import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

export function getDatabase() {
  if (!db) {
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  const migrationPath = path.join(__dirname, '../migrations/0001_init.sql');
  if (fs.existsSync(migrationPath)) {
    db.exec(fs.readFileSync(migrationPath, 'utf8'));
    console.log('✅ Database migrated');
  }
}

// ─── Projects ──────────────────────────────────────────────

export function getProjectByApiKey(apiKey) {
  return getDatabase()
    .prepare('SELECT * FROM projects WHERE api_key = ? AND is_active = 1')
    .get(apiKey);
}

// ─── Product Cache ─────────────────────────────────────────

export function getCachedProduct(barcode, source) {
  const now = Date.now();
  return getDatabase()
    .prepare(`
      SELECT * FROM product_cache 
      WHERE barcode = ? AND source = ? AND expires_at > ?
    `)
    .get(barcode, source, now);
}

export function getCachedProductAnySource(barcode) {
  const now = Date.now();
  return getDatabase()
    .prepare(`
      SELECT * FROM product_cache 
      WHERE barcode = ? AND expires_at > ? AND found = 1
      ORDER BY created_at DESC LIMIT 1
    `)
    .get(barcode, now);
}

export function saveProductToCache(entry) {
  const now = Date.now();
  const ttl = entry.found ? config.cache.sqliteTtl : config.cache.negativeTtl;
  const expiresAt = now + ttl * 1000;

  getDatabase()
    .prepare(`
      INSERT INTO product_cache 
      (barcode, barcode_type, source, found, product_data, raw_upstream, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(barcode, source) DO UPDATE SET
        barcode_type = excluded.barcode_type,
        found = excluded.found,
        product_data = excluded.product_data,
        raw_upstream = excluded.raw_upstream,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at
    `)
    .run(
      entry.barcode,
      entry.barcode_type || null,
      entry.source,
      entry.found ? 1 : 0,
      entry.product_data,
      entry.raw_upstream || null,
      expiresAt,
      now
    );
}

export function purgeExpiredProducts() {
  const result = getDatabase()
    .prepare('DELETE FROM product_cache WHERE expires_at < ?')
    .run(Date.now());
  return result.changes;
}

export function searchCachedProducts(query, limit = 20, offset = 0) {
  const like = `%${query}%`;
  const rows = getDatabase()
    .prepare(`
      SELECT barcode, barcode_type, source, product_data, created_at
      FROM product_cache
      WHERE found = 1 AND expires_at > ? AND product_data LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(Date.now(), like, limit, offset);
  const total = getDatabase()
    .prepare(`
      SELECT COUNT(*) as c FROM product_cache
      WHERE found = 1 AND expires_at > ? AND product_data LIKE ?
    `)
    .get(Date.now(), like);
  return { rows, total: total?.c ?? 0 };
}

export function browseByCategory(category, limit = 20, offset = 0) {
  const like = `%${category}%`;
  const rows = getDatabase()
    .prepare(`
      SELECT barcode, barcode_type, source, product_data, created_at
      FROM product_cache
      WHERE found = 1 AND expires_at > ? AND product_data LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(Date.now(), like, limit, offset);
  const total = getDatabase()
    .prepare(`
      SELECT COUNT(*) as c FROM product_cache
      WHERE found = 1 AND expires_at > ? AND product_data LIKE ?
    `)
    .get(Date.now(), like);
  return { rows, total: total?.c ?? 0 };
}

// ─── Usage Logs ────────────────────────────────────────────

export function logUsage(projectId, entry) {
  const result = getDatabase()
    .prepare(`
      INSERT INTO usage_log 
      (project_id, endpoint, barcode, query, found, cache_hit, upstream, 
       upstream_calls, duration_ms, client_ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      projectId,
      entry.endpoint,
      entry.barcode || null,
      entry.query || null,
      entry.found !== undefined ? (entry.found ? 1 : 0) : null,
      entry.cache_hit || null,
      entry.upstream || null,
      entry.upstream_calls || 0,
      entry.duration_ms || null,
      entry.client_ip || null,
      Date.now()
    );

  // Update daily summary
  const date = new Date().toISOString().slice(0, 10);
  const isHit = entry.cache_hit && entry.cache_hit !== 'miss' ? 1 : 0;
  const isFound = entry.found ? 1 : 0;
  const isNotFound = entry.found === false ? 1 : 0;

  getDatabase()
    .prepare(`
      INSERT INTO daily_summary 
      (project_id, date, total_lookups, cache_hits, upstream_calls, 
       products_found, products_not_found, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, date) DO UPDATE SET
        total_lookups = total_lookups + 1,
        cache_hits = cache_hits + excluded.cache_hits,
        upstream_calls = upstream_calls + excluded.upstream_calls,
        products_found = products_found + excluded.products_found,
        products_not_found = products_not_found + excluded.products_not_found,
        updated_at = excluded.updated_at
    `)
    .run(
      projectId,
      date,
      isHit,
      entry.upstream_calls || 0,
      isFound,
      isNotFound,
      Date.now()
    );

  return result.lastInsertRowid;
}

export function getStats(projectId, days = 30) {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = getDatabase()
    .prepare(`
      SELECT date, total_lookups, cache_hits, upstream_calls,
             products_found, products_not_found
      FROM daily_summary 
      WHERE project_id = ? AND date >= ?
      ORDER BY date ASC
    `)
    .all(projectId, fromDate);

  const totalLookups = rows.reduce((s, r) => s + r.total_lookups, 0);
  const totalHits = rows.reduce((s, r) => s + r.cache_hits, 0);
  const totalUpstream = rows.reduce((s, r) => s + r.upstream_calls, 0);
  const totalFound = rows.reduce((s, r) => s + r.products_found, 0);
  const totalNotFound = rows.reduce((s, r) => s + r.products_not_found, 0);

  const bySource = getDatabase()
    .prepare(`
      SELECT upstream, COUNT(*) as c FROM usage_log 
      WHERE project_id = ? AND upstream IS NOT NULL AND found = 1
      GROUP BY upstream ORDER BY c DESC
    `)
    .all(projectId);

  const sourceMap = {};
  for (const r of bySource) sourceMap[r.upstream] = r.c;

  return {
    days,
    daily: rows,
    totals: {
      total_lookups: totalLookups,
      cache_hits: totalHits,
      cache_hit_rate_percent: totalLookups > 0
        ? parseFloat(((totalHits / totalLookups) * 100).toFixed(2))
        : 0,
      upstream_calls: totalUpstream,
      upstream_saved: totalLookups - totalUpstream,
      products_found: totalFound,
      products_not_found: totalNotFound,
    },
    by_source: sourceMap,
  };
}
