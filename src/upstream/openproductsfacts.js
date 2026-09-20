import { fetchFromOpenFacts } from './openfoodfacts.js';

// ponytail: thin wrapper reuses generic Open*Facts fetcher — no duplicated HTTP logic.
export async function fetchGeneralProduct(barcode) {
  return fetchFromOpenFacts('products', barcode);
}

export { fetchFromOpenFacts as fetchFromOpenProductsFacts };
