import { fetchFromOpenFacts } from './openfoodfacts.js';
import { fetchFromOpenLibrary } from './openlibrary.js';
import { normalizeOpenFactsProduct, normalizeOpenLibraryBook } from '../normalizer.js';
import { suggestSources } from '../barcode/classifier.js';

/**
 * Try each source in order until a product is found.
 * Returns { found, source, product, upstream_calls }.
 */
export async function lookupBarcode(barcode, sources) {
  const suggested = suggestSources(barcode);
  const sourcesToTry = sources && sources.length > 0
    ? sources
    : suggested;

  let upstreamCalls = 0;

  for (const source of sourcesToTry) {
    upstreamCalls++;

    if (source === 'books') {
      const result = await fetchFromOpenLibrary(barcode);
      if (result.found) {
        return {
          found: true,
          source: 'openlibrary',
          product: normalizeOpenLibraryBook(result.raw, barcode),
          upstream_calls: upstreamCalls,
        };
      }
      continue;
    }

    // food | beauty | pet | products
    const result = await fetchFromOpenFacts(source, barcode);
    if (result.found) {
      return {
        found: true,
        source: `open${source}facts`,
        product: normalizeOpenFactsProduct(result.raw, `open${source}facts`, barcode),
        upstream_calls: upstreamCalls,
      };
    }
  }

  return {
    found: false,
    upstream_calls: upstreamCalls,
  };
}
