import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4011'),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/bpls.db',
  logLevel: process.env.LOG_LEVEL || 'info',

  cache: {
    memoryTtl: parseInt(process.env.MEMORY_CACHE_TTL || '3600'),
    sqliteTtl: parseInt(process.env.SQLITE_CACHE_TTL || '2592000'),
    negativeTtl: parseInt(process.env.NEGATIVE_CACHE_TTL || '86400'),
  },

  upstream: {
    off: process.env.OFF_URL || 'https://world.openfoodfacts.org',
    obf: process.env.OBF_URL || 'https://world.openbeautyfacts.org',
    opff: process.env.OPFF_URL || 'https://world.openpetfoodfacts.org',
    opf: process.env.OPF_URL || 'https://world.openproductsfacts.org',
    openlibrary: process.env.OPENLIBRARY_URL || 'https://openlibrary.org',
    userAgent: process.env.USER_AGENT || 'B-Pls/1.0',
    timeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || '10000'),
  },

  limits: {
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '50'),
    defaultSearchLimit: parseInt(process.env.DEFAULT_SEARCH_LIMIT || '20'),
    maxSearchLimit: parseInt(process.env.MAX_SEARCH_LIMIT || '100'),
  },
};
