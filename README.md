# B-Pls — Barcode / Product Lookup Service

Centralized barcode-to-product lookup API. Give it an EAN, UPC, or ISBN and it
returns structured product data — name, brand, category, image, nutrition,
ingredients, allergens, or book metadata. All data comes from free, open APIs
with no keys required.

**Stack:** Node.js 20+ · Fastify 4 · SQLite (better-sqlite3) · node-cache
**Port:** `4011` · **Cost:** $0/month · **Status:** ✅ Production ready (v1.0.0)

> Full build spec: [`B-Pls.md`](./B-Pls.md). Endpoint reference: [`docs/API.md`](./docs/API.md).
> Operations: [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). Design: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
> Interactive diagram: [`docs/bpls-architecture.html`](./docs/bpls-architecture.html) (open in a browser).

## Features

- **Lookup by barcode** — EAN-13, EAN-8, UPC-A, UPC-E, ISBN-10, ISBN-13
- **Check-digit validation first** — rejects typos locally before any upstream call
- **Multi-source aggregation** — Open Food Facts, Open Beauty Facts, Open Pet Food
  Facts, Open Products Facts, Open Library (ISBN)
- **2-layer cache** — memory (1 h, ~2 ms) + SQLite (30 d, ~14 ms) + negative cache (1 d)
- **Batch lookup** — up to 50 barcodes per request
- **Search & category browse** over the local product cache
- **Multi-tenant** — per-project `X-API-Key` auth, per-endpoint usage logs, daily summaries
- **Stats** — cache hit rate, upstream calls saved, breakdown by source

## Quickstart

```bash
npm install
npm run migrate   # create SQLite schema in ./data/bpls.db
npm run seed      # Shop A + Gig4Gig API keys
npm start         # → http://localhost:4011
```

Or with Docker (Linux, production-parity):

```bash
docker compose up --build -d
docker compose exec bpls npm run seed
```

## Try it

```bash
KEY=shop-a-bpls-key-2026

# Validate (no upstream call, <1 ms)
curl -H "X-API-Key: $KEY" localhost:4011/barcode/validate/5449000000996

# Look up Coca-Cola (first call hits upstream, repeat hits memory cache)
curl -H "X-API-Key: $KEY" localhost:4011/barcode/5449000000996

# Book by ISBN
curl -H "X-API-Key: $KEY" "localhost:4011/barcode/9780140328721?refresh=true"

# Batch
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"barcodes":["5449000000996","9780140328721","3017620422003"]}' \
  localhost:4011/barcode/batch

# Search the local cache, browse a category, view stats
curl -H "X-API-Key: $KEY" "localhost:4011/search?q=Coca"
curl -H "X-API-Key: $KEY" "localhost:4011/category/cola"
curl -H "X-API-Key: $KEY" "localhost:4011/stats?days=30"
```

Seeded API keys: `shop-a-bpls-key-2026` (all sources) · `gig4gig-bpls-key-2026`
(products + books). Set a real contact in `USER_AGENT` — Open\*Facts requires it.

## Configuration

All settings come from `.env` (see `.env.example`). Key variables:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4011` | Listen port |
| `DATABASE_PATH` | `./data/bpls.db` | SQLite file |
| `MEMORY_CACHE_TTL` | `3600` | Memory cache, seconds (1 h) |
| `SQLITE_CACHE_TTL` | `2592000` | SQLite cache, seconds (30 d) |
| `NEGATIVE_CACHE_TTL` | `86400` | Not-found cache, seconds (1 d) |
| `USER_AGENT` | `B-Pls/1.0 (…)` | Required by upstream APIs |
| `MAX_BATCH_SIZE` | `50` | Batch limit |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Per-upstream-call timeout |

## Project structure

```
├── migrations/0001_init.sql     # projects, product_cache, usage_log, daily_summary
├── src/
│   ├── server.js                # Fastify wiring, public /health + /
│   ├── config.js db.js cache.js # env, SQLite access, memory cache
│   ├── migrate.js seed.js       # CLI: migrate / seed tenants
│   ├── normalizer.js            # unified product + book schema
│   ├── barcode/validator.js     # EAN/UPC/ISBN check digits
│   ├── barcode/classifier.js    # source hinting (ISBN → books)
│   ├── upstream/                # openfoodfacts (+beauty/pet/products), openlibrary, aggregator
│   ├── routes/                  # lookup (+batch), validate, search, category, stats
│   └── middleware/auth.js       # X-API-Key → project
├── test/selfcheck.js            # offline logic check: node test/selfcheck.js
├── docs/                        # API, OPERATIONS, ARCHITECTURE
└── docker-compose.yml Dockerfile ecosystem.config.js
```

## Endpoints

| Method | Path | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| `GET` | `/health`, `/` | no | Health check, service index |
| `GET` | `/barcode/validate/:code` | yes | Check-digit validation only |
| `GET` | `/barcode/:code` | yes | Lookup (`?sources=`, `?refresh=true`) |
| `POST` | `/barcode/batch` | yes | Up to 50 barcodes |
| `GET` | `/search?q=` | yes | Full-text over local cache |
| `GET` | `/category/:cat` | yes | Browse local cache by category |
| `GET` | `/stats?days=` | yes | Hit rate, savings, by-source |

Details and response shapes: [`docs/API.md`](./docs/API.md).

## Testing

```bash
node test/selfcheck.js   # offline: validator, classifier, normalizers (no network)
```

Live verification used during build (all green locally + in Docker):
auth 401s · validation matrix · cold/miss → memory → SQLite tiers ·
batch limits · search/category · stats · multi-tenant isolation.

## Notes & deviations from spec

- `better-sqlite3` **v12** (spec: v9) — v9 has no Node 24 prebuilds.
- Docker base **node:20-slim + build tools** (spec: alpine) — no musl prebuilds;
  `.dockerignore` prevents host `node_modules` shadowing the Linux install.
- `openlibrary.js` tries the legacy `bibkeys` API, then falls back to modern
  `/isbn/*.json` with author/work enrichment — the legacy endpoint returns `{}`
  for valid ISBNs as of 2026, and Windows Node cannot complete OpenLibrary's TLS
  handshake (Linux/Docker unaffected).
- Spec example `9780140328721` resolves to *"Fantastic Mr. Fox"*, not *"Matilda"*.

## License

MIT — Emmanuel Phiri, September 2026.
