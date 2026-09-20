import { config } from '../config.js';

const SOURCES = {
  food: config.upstream.off,
  beauty: config.upstream.obf,
  pet: config.upstream.opff,
  products: config.upstream.opf,
};

/**
 * Fetch a product from any of the Open*Facts APIs.
 */
export async function fetchFromOpenFacts(source, barcode) {
  const baseUrl = SOURCES[source];
  if (!baseUrl) throw new Error(`Unknown Open*Facts source: ${source}`);

  const url = `${baseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json`;

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

    if (res.status === 404) {
      return { found: false, source: `open${source}facts`, barcode };
    }

    if (!res.ok) {
      return {
        found: false,
        source: `open${source}facts`,
        barcode,
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();

    if (data.status === 0 || !data.product) {
      return { found: false, source: `open${source}facts`, barcode };
    }

    return {
      found: true,
      source: `open${source}facts`,
      barcode,
      raw: data.product,
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      found: false,
      source: `open${source}facts`,
      barcode,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
}
