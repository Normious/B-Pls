/**
 * Normalize a product from any Open*Facts source into a unified schema.
 */
export function normalizeOpenFactsProduct(raw, source, barcode) {
  const nutriments = raw.nutriments || {};
  const nutriscore = raw.nutriscore_grade || raw.nutrition_grades || null;
  const novaGroup = raw.nova_group || null;
  const ecoscore = raw.ecoscore_grade || null;

  return {
    barcode,
    source,
    type: 'product',

    name: raw.product_name || raw.product_name_en || null,
    brand: extractFirst(raw.brands),
    brands: splitAndTrim(raw.brands),
    quantity: raw.quantity || null,
    categories: splitAndTrim(raw.categories),
    labels: splitAndTrim(raw.labels),
    packaging: splitAndTrim(raw.packaging),

    image_url: raw.image_url || raw.image_front_url || null,
    image_small_url: raw.image_small_url || raw.image_front_small_url || null,

    ingredients_text: raw.ingredients_text || raw.ingredients_text_en || null,
    allergens: splitAndTrim(raw.allergens),
    traces: splitAndTrim(raw.traces),
    additives: splitAndTrim(raw.additives_tags),

    nutrition: {
      grade: nutriscore,
      nova_group: novaGroup,
      ecoscore: ecoscore,
      per_100g: {
        energy_kcal: num(nutriments['energy-kcal_100g']),
        fat: num(nutriments.fat_100g),
        saturated_fat: num(nutriments['saturated-fat_100g']),
        carbohydrates: num(nutriments.carbohydrates_100g),
        sugars: num(nutriments.sugars_100g),
        fiber: num(nutriments.fiber_100g),
        proteins: num(nutriments.proteins_100g),
        salt: num(nutriments.salt_100g),
        sodium: num(nutriments.sodium_100g),
      },
    },

    countries: splitAndTrim(raw.countries),
    stores: splitAndTrim(raw.stores),

    created_at: raw.created_t ? new Date(raw.created_t).getTime() : null,
    updated_at: raw.last_modified_t ? new Date(raw.last_modified_t).getTime() : null,
  };
}

/**
 * Normalize an Open Library book (handles legacy jscmd=data + modern /isbn/*.json shapes).
 */
export function normalizeOpenLibraryBook(raw, barcode) {
  if (raw._modern) {
    const coverId = raw.covers?.find((c) => c > 0);
    const publishers = Array.isArray(raw.publishers) ? raw.publishers : [];
    return {
      barcode,
      source: 'openlibrary',
      type: 'book',

      name: raw.title || null,
      subtitle: raw.subtitle || null,
      brand: publishers[0] || null,
      brands: publishers,
      quantity: null,
      categories: raw._subjects || [],
      labels: [],
      packaging: [],

      image_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
      image_small_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-S.jpg` : null,

      ingredients_text: null,
      allergens: [],
      traces: [],
      additives: [],

      nutrition: null,

      authors: raw._authorNames || [],
      publish_date: raw.publish_date || null,
      number_of_pages: raw.number_of_pages || null,
      publishers,

      countries: [],
      stores: [],

      created_at: null,
      updated_at: null,
    };
  }

  return {
    barcode,
    source: 'openlibrary',
    type: 'book',

    name: raw.title || null,
    subtitle: raw.subtitle || null,
    brand: extractFirst(raw.publishers?.map((p) => p.name).join(',')) || null,
    brands: (raw.publishers || []).map((p) => p.name),
    quantity: null,
    categories: raw.subjects?.map((s) => s.name) || [],
    labels: [],
    packaging: [],

    image_url: raw.cover?.large || raw.cover?.medium || null,
    image_small_url: raw.cover?.small || null,

    ingredients_text: null,
    allergens: [],
    traces: [],
    additives: [],

    nutrition: null,

    authors: (raw.authors || []).map((a) => a.name),
    publish_date: raw.publish_date || null,
    number_of_pages: raw.number_of_pages || null,
    publishers: (raw.publishers || []).map((p) => p.name),

    countries: [],
    stores: [],

    created_at: null,
    updated_at: null,
  };
}

// ─── Helpers ───────────────────────────────────────────────

function splitAndTrim(str) {
  if (!str) return [];
  return String(str)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractFirst(str) {
  if (!str) return null;
  return String(str).split(',')[0].trim() || null;
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
