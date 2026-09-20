import { config } from '../config.js';

/**
 * Look up a book by ISBN via Open Library.
 * Tries legacy bibkeys API first (spec), falls back to modern /isbn/*.json
 * (legacy endpoint returns {} for valid ISBNs as of 2026).
 */
export async function fetchFromOpenLibrary(barcode) {
  const legacy = await fetchLegacy(barcode);
  if (legacy.found) return legacy;
  return fetchModern(barcode);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.upstream.timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': config.upstream.userAgent,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchLegacy(barcode) {
  const url = `${config.upstream.openlibrary}/api/books?bibkeys=ISBN:${encodeURIComponent(barcode)}&format=json&jscmd=data`;
  try {
    const data = await fetchJson(url);
    const key = `ISBN:${barcode}`;
    if (data && data[key]) {
      return { found: true, source: 'openlibrary', barcode, raw: data[key] };
    }
  } catch {
    // fall through to modern
  }
  return { found: false, source: 'openlibrary', barcode };
}

async function fetchModern(barcode) {
  const edition = await fetchJson(
    `${config.upstream.openlibrary}/isbn/${encodeURIComponent(barcode)}.json`
  );
  if (!edition || !edition.title) {
    return { found: false, source: 'openlibrary', barcode };
  }

  // Best-effort enrichment: author names + work subjects (parallel, failures ignored)
  let authorNames = [];
  let subjects = [];
  try {
    const authorKey = edition.authors?.[0]?.key;
    const workKey = edition.works?.[0]?.key;
    const [author, work] = await Promise.all([
      authorKey ? fetchJson(`${config.upstream.openlibrary}${authorKey}.json`) : null,
      workKey ? fetchJson(`${config.upstream.openlibrary}${workKey}.json`) : null,
    ]);
    if (author?.name) authorNames = [author.name];
    if (Array.isArray(work?.subjects)) subjects = work.subjects.slice(0, 20);
  } catch {
    // enrichment is optional
  }

  return {
    found: true,
    source: 'openlibrary',
    barcode,
    raw: { ...edition, _authorNames: authorNames, _subjects: subjects, _modern: true },
  };
}
