import NodeCache from 'node-cache';
import { config } from './config.js';

const memoryCache = new NodeCache({
  stdTTL: config.cache.memoryTtl,
  checkperiod: 120,
  useClones: false,
});

export function getMemory(key) {
  return memoryCache.get(key);
}

export function setMemory(key, value) {
  memoryCache.set(key, value);
}

export function delMemory(key) {
  memoryCache.del(key);
}

export function getCacheStats() {
  const stats = memoryCache.getStats();
  return {
    keys: memoryCache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
  };
}
