# B-Pls API Reference (v1.0.0)

Base URL `http://localhost:4011`. All routes except `/health` and `/` require the
`X-API-Key` header (per-project key, see `npm run seed`).

Conventions: success responses include `success: true`; lookups include
`duration_ms` and `cache` (`memory` | `sqlite` | `miss`). Timestamps are
unix-ms unless noted. Examples below are real shapes from local verification
(values trimmed).

## Auth

```
X-API-Key: shop-a-bpls-key-2026
```

| Status | Body | When |
| :--- | :--- | :--- |
| `401` | `{"error":"Missing X-API-Key header"}` | header absent |
| `401` | `{"error":"Invalid or inactive API Key"}` | unknown/disabled key |

## GET /health · GET /

Public. Health check and service index (endpoints, sources, barcode types).

```json
{ "service": "B-Pls — Barcode Lookup Service", "version": "1.0.0", "status": "ok", "timestamp": "2026-09-20T…" }
```

## GET /barcode/validate/:code

Pure local check-digit validation. No upstream call, <1 ms.

```bash
curl -H "X-API-Key: $KEY" /barcode/validate/5449000000996
```

```json
{ "success": true, "barcode": "5449000000996", "valid": true, "type": "ean13", "normalized": "5449000000996", "reason": null }
```

`type`: `ean13` `ean8` `upca` `upce` `isbn13` `isbn10` `unknown`.
`reason` (when invalid): `non_numeric` `unsupported_length` `not_a_string`,
or absent/`check_digit_failed` for bad check digits (HTTP 200 with `valid: false`).

## GET /barcode/:code

Full lookup: validate → memory → SQLite → upstream. Query params:

| Param | Example | Effect |
| :--- | :--- | :--- |
| `sources` | `?sources=food,books` | override source order (`food,beauty,pet,products,books`) |
| `refresh` | `?refresh=true` | bypass both caches |

**200 — found (food product):**

```json
{
  "success": true, "barcode": "5449000000996", "barcode_type": "ean13",
  "cache": "miss", "source": "openfoodfacts", "upstream_calls": 1,
  "product": {
    "barcode": "5449000000996", "source": "openfoodfacts", "type": "product",
    "name": "Coca-Cola", "brand": "COCA-COLA SERVICES SA/NV", "quantity": "330 ml",
    "categories": ["Bebidas de cola"], "labels": [], "packaging": [],
    "image_url": "https://images.openfoodfacts.org/…400.jpg",
    "ingredients_text": "Agua carbonatada, azúcar, …",
    "allergens": [], "traces": [],
    "nutrition": { "grade": "e", "nova_group": 4, "ecoscore": "not-applicable",
      "per_100g": { "energy_kcal": 42, "fat": 0, "carbohydrates": 10.6, "sugars": 10.6, "proteins": 0, "salt": 0, "sodium": 0 } },
    "countries": ["España"], "stores": []
  },
  "duration_ms": 1484
}
```

**200 — found (book):** same envelope with `"source": "openlibrary"` and a book
product: `name, subtitle, authors[], publishers[], publish_date, number_of_pages,
image_url` (Covers API), `nutrition: null`.

**400 — invalid barcode:** `{"success":false,"error":"Invalid barcode",
"reason":"unsupported_length","barcode":"12345","detected_type":"unknown"}`

**404 — not found upstream:** `{"success":false,"error":"Product not found in any
source","barcode_type":"isbn13","cache":"miss","upstream_calls":1,…}` (result is
negative-cached for 1 day).

## POST /barcode/batch

Up to 50 barcodes (`MAX_BATCH_SIZE`). Same validate → memory → SQLite →
upstream pipeline per item; one aggregated usage-log entry.

```bash
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"barcodes":["5449000000996","9780140328721"],"sources":["food","books"]}' \
  /barcode/batch
```

```json
{
  "success": true, "total": 3, "found": 3, "duration_ms": 1,
  "results": [
    { "barcode": "5449000000996", "success": true, "cache": "memory", "product": {…} },
    { "barcode": "9780140328721", "success": true, "cache": "memory", "product": {…} },
    { "barcode": "bad", "success": false, "error": "invalid_barcode", "reason": "…" }
  ]
}
```

Oversize body (>50) → Fastify `400 FST_ERR_VALIDATION`.

## GET /search?q=&limit=&offset=

Substring search over cached product JSON (`product_cache`, `found = 1`,
unexpired). `limit` defaults to `DEFAULT_SEARCH_LIMIT` (20), capped at
`MAX_SEARCH_LIMIT` (100).

```json
{ "success": true, "query": "Fox", "total": 1, "limit": 20, "offset": 0,
  "count": 1, "results": [{…book…}], "duration_ms": 3 }
```

Missing `q` → `400 {"success":false,"error":"Missing ?q= query"}`.

## GET /category/:cat?limit=&offset=

Same mechanics as search, filtered by category text. Missing category → 400.

```json
{ "success": true, "category": "Fiction", "total": 1, "limit": 3, "offset": 0,
  "count": 1, "results": [{…}], "duration_ms": 2 }
```

## GET /stats?days=

Per-project analytics from `daily_summary` + `usage_log`. `days` ≤ 365.

```json
{
  "success": true, "days": 30,
  "daily": [{ "date": "2026-09-20", "total_lookups": 21, "cache_hits": 14, "upstream_calls": 6, "products_found": 17, "products_not_found": 2 }],
  "totals": { "total_lookups": 21, "cache_hits": 14, "cache_hit_rate_percent": 66.67,
    "upstream_calls": 6, "upstream_saved": 15, "products_found": 17, "products_not_found": 2 },
  "by_source": { "openfoodfacts": 4, "openlibrary": 1 },
  "memory_cache": { "keys": 3, "hits": 4, "misses": 2 }
}
```

## Latency guide (verified)

| Path | Typical |
| :--- | :--- |
| validate | <1 ms |
| memory hit | ~2 ms |
| SQLite hit | ~14 ms |
| cold, single source | 0.3–1.5 s |
| cold, multi-source miss | up to ~2.5 s |
| book via OpenLibrary | ~4 s (author + work enrichment) |
