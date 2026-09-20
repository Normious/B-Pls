import { validateBarcode } from './validator.js';

/**
 * Determine which Open*Facts source is most likely to have this barcode.
 * Uses prefix hints from GS1 country codes and returns an ordered list.
 */
export function suggestSources(barcode) {
  const { valid, type } = validateBarcode(barcode);

  if (!valid) return [];

  // Books → Open Library
  if (type === 'isbn10' || type === 'isbn13') {
    return ['books'];
  }

  // Default: try all in order
  return ['food', 'beauty', 'pet', 'products'];
}

export { validateBarcode };
