import { fetchFromOpenFacts } from './openfoodfacts.js';

// ponytail: thin wrapper reuses generic Open*Facts fetcher — no duplicated HTTP logic.
export async function fetchBeautyProduct(barcode) {
  return fetchFromOpenFacts('beauty', barcode);
}

export { fetchFromOpenFacts as fetchFromOpenBeautyFacts };
