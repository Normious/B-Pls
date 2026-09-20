import assert from 'node:assert';
import { validateBarcode } from '../src/barcode/validator.js';
import { suggestSources } from '../src/barcode/classifier.js';
import { normalizeOpenFactsProduct, normalizeOpenLibraryBook } from '../src/normalizer.js';

// validator
assert.equal(validateBarcode('5449000000996').valid, true);
assert.equal(validateBarcode('5449000000996').type, 'ean13');
assert.equal(validateBarcode('5449000000997').valid, false);
assert.equal(validateBarcode('9780140328721').type, 'isbn13');
assert.equal(validateBarcode('036000291452').type, 'upca');
assert.equal(validateBarcode('96385074').type, 'ean8');
assert.equal(validateBarcode('ABC123').valid, false);
assert.equal(validateBarcode('12345').reason, 'unsupported_length');

// classifier
assert.deepEqual(suggestSources('9780140328721'), ['books']);
assert.deepEqual(suggestSources('5449000000996'), ['food', 'beauty', 'pet', 'products']);
assert.deepEqual(suggestSources('12345'), []);

// openfacts normalizer
const p = normalizeOpenFactsProduct(
  { product_name: 'Coca-Cola', brands: 'Coca-Cola', nutriments: { 'energy-kcal_100g': 42 } },
  'openfoodfacts', '5449000000996'
);
assert.equal(p.name, 'Coca-Cola');
assert.equal(p.nutrition.per_100g.energy_kcal, 42);

// openlibrary legacy shape (jscmd=data)
const b1 = normalizeOpenLibraryBook(
  { title: 'Matilda', authors: [{ name: 'Roald Dahl' }], publishers: [{ name: 'Puffin' }], cover: { large: 'L', small: 'S' } },
  '9780140328721'
);
assert.equal(b1.name, 'Matilda');
assert.deepEqual(b1.authors, ['Roald Dahl']);

// openlibrary modern shape (/isbn/*.json)
const b2 = normalizeOpenLibraryBook(
  { title: 'Fantastic Mr. Fox', publishers: ['Puffin'], covers: [8739161], publish_date: '1988', _authorNames: ['Roald Dahl'], _subjects: ['Fantasy'], _modern: true },
  '9780140328721'
);
assert.equal(b2.name, 'Fantastic Mr. Fox');
assert.deepEqual(b2.authors, ['Roald Dahl']);
assert.ok(b2.image_url.includes('8739161'));

console.log('✅ selfcheck passed');
