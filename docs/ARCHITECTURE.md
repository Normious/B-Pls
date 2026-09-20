# B-Pls Architecture (v1.0.0, as built)

> Interactive diagram: [`bpls-architecture.html`](./bpls-architecture.html) (open in a browser).

## Request flow

```
Client (X-API-Key + barcode)
  → middleware/auth.js          → 401 unless key maps to active project
  → routes/lookup.js
      1. barcode/validator.js   → 400 on bad check digit (no I/O)
      2. cache.js (node-cache)  → hit: log + return (~2 ms)
      3. db.js SQLite           → hit: warm memory, log + return (~14 ms)
      4. upstream/aggregator.js → miss: fetch sources in order, cache, log, return
  → db.js logUsage()            → usage_log row + daily_summary upsert (every lookup)
```

`POST /barcode/batch` runs the same per-item pipeline in a loop and writes one
aggregated usage row. `search`/`category` read `product_cache` only (LIKE over
stored JSON). `stats` aggregates `daily_summary` + `usage_log`. Auth is a single
`preHandler` hook; `/health` and `/` are public and unlogged.

## Two-layer cache

| Tier | Store | TTL | Hit cost | Key |
| :--- | :--- | :--- | :--- | :--- |
| L1 | `node-cache` (in-process) | 1 h (`MEMORY_CACHE_TTL`) | ~2 ms | `barcode:<code>` |
| L2 | SQLite `product_cache` | 30 d (`SQLITE_CACHE_TTL`) | ~14 ms | `(barcode, source)` row, `found = 1` |
| L– | SQLite + memory | 1 d (`NEGATIVE_CACHE_TTL`) | — | `found = 0` row / `{found:false}` entry |

Verified behavior: cold miss (~1.4 s) → memory (~2 ms) → after restart first hit
14 ms (SQLite) → memory again (~2 ms). SQLite `found = 0` rows distinguish
"looked, absent" from "never looked"; memory mirrors them so repeat misses never
touch the DB. `?refresh=true` skips L1+L2. No expiry scheduler ships —
`purgeExpiredProducts()` is available for a cron tick (see OPERATIONS).

## Barcode validation (`barcode/`)

`validator.js` implements modulo-10 check digits for EAN-13/8 and UPC-A, UPC-E
expansion to UPC-A, and ISBN-10 (`mod 11`, `X` check). Lengths 10/13/12/8 map to
`isbn10 / isbn13|ean13 / upca / ean8|upce`; anything else is `unknown` with a
machine-readable `reason`. `classifier.js:suggestSources()` short-circuits ISBNs
to `['books']` (1 upstream call instead of 4+); everything else tries
`food → beauty → pet → products`. ~15% of user-submitted barcodes are typos —
rejecting them pre-upstream is the cheapest optimization in the system.

## Upstream aggregation (`upstream/`)

- `openfoodfacts.js` — one generic `fetchFromOpenFacts(source, barcode)` against
  `/api/v2/product/:code.json` with `User-Agent` (upstream policy), 10 s
  AbortController timeout, and `{found, source, raw, error}` results. 404 and
  `status: 0` both mean "absent" (no throw).
- `openbeautyfacts.js` / `openpetfoodfacts.js` / `openproductsfacts.js` — thin
  re-export wrappers (one line each, no duplicated HTTP logic).
- `openlibrary.js` — **legacy `bibkeys` API first, modern `/isbn/:isbn.json`
  fallback.** Rationale: as of 2026 the legacy endpoint returns `{}` for valid
  ISBNs, and Windows Node cannot complete OpenLibrary's TLS handshake at all
  (curl/Linux fine). The modern path enriches the edition with author name +
  work subjects (parallel, best-effort) and tags the payload `_modern`.
- `aggregator.js:lookupBarcode()` — tries sources in order, counts
  `upstream_calls`, normalizes the first hit. Returns `{found:false}` after
  exhausting sources; the route then negative-caches.

## Unified schema (`normalizer.js`)

`normalizeOpenFactsProduct()` maps any Open\*Facts payload to one product shape
(name/brand/brands/quantity/categories/labels/packaging/images/ingredients/
allergens/traces/additives/nutrition{grade,nova,ecoscore,per_100g}/countries/
stores). `normalizeOpenLibraryBook()` handles **both** legacy (`cover{}`, object
publishers/authors) and modern (`covers[]` → Covers-API URLs, string publishers,
`_authorNames`, `_subjects`) shapes into the same envelope with `type: 'book'`
and `nutrition: null`. Consumers never branch on source.

## Multi-tenancy & analytics (`db.js`, `migrations/0001_init.sql`)

- `projects` — `api_key` UNIQUE, `is_active` kill-switch, `default_sources`
  preference (advisory in v1.0.0). Indexed on `api_key`.
- `product_cache` — `UNIQUE(barcode, source)`, indexes on barcode/expiry/source.
  Stores normalized JSON + raw upstream (debug) + `barcode_type`.
- `usage_log` — one row per lookup/search/category/batch: endpoint, barcode/query,
  `found`, `cache_hit` (`memory|sqlite|miss`), resolving `upstream`,
  `upstream_calls`, `duration_ms`, `client_ip`. Indexed by project/barcode/time.
- `daily_summary` — per-project per-day counters upserted on every log write;
  `getStats()` derives totals, hit-rate %, `upstream_saved = lookups − upstream`,
  and `by_source`. WAL mode + foreign keys on.

## Key decisions (why)

- **Open\*Facts over UPCitemdb** — free, keyless, millions of products.
- **Validation before upstream** — garbage rejected in <1 ms.
- **ISBN → Open Library shortcut** — better book coverage than Food Facts.
- **30 d product TTL / 1 d miss TTL** — products change slowly; misses deserve a
  second chance soon.
- **SQLite over Postgres/Redis** — single file, zero ops, WAL is plenty at this
  scale; memory tier covers hot keys.
- **Spec deviations** — better-sqlite3 v12 (Node 24 prebuilds), slim+toolchain
  Docker image (no musl prebuilds), `.dockerignore`, dual-shape book normalizer
  (upstream API drift). See CHANGELOG.
