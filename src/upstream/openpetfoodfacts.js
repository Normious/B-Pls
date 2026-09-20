import { fetchFromOpenFacts } from './openfoodfacts.js';

// ponytail: thin wrapper reuses generic Open*Facts fetcher — no duplicated HTTP logic.
export async function fetchPetFoodProduct(barcode) {
  return fetchFromOpenFacts('pet', barcode);
}

export { fetchFromOpenFacts as fetchFromOpenPetFoodFacts };
