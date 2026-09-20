# Changelog

## v1.0.0 — 2026-09-20 — Production ready ✅

Initial release. Full spec (`B-Pls.md`) implemented in root (no wrapper folder)
and verified locally on Windows (Node 24) **and** in Docker (Debian, Node 20).

**Implemented:** barcode lookup (EAN-13/8, UPC-A/E, ISBN-10/13) · check-digit
validation route · batch ≤50 · multi-source aggregation (Food, Beauty, Pet,
Products, Open Library) · memory (1 h) + SQLite (30 d) + negative (1 d) caching ·
search & category over local cache · per-project API keys + usage/analytics ·
stats with hit-rate and upstream savings · Dockerfile + compose + PM2 config ·
migrate/seed CLIs · `test/selfcheck.js` offline checks.

**Verified:** auth 401s · validation matrix (valid/invalid/ISBN/UPC/EAN-8/malformed) ·
cold miss → memory (~2 ms) → post-restart SQLite (~14 ms) · batch incl. 51-item
400 · `refresh` + `sources` · search/category · stats · tenant isolation ·
book end-to-end in Docker (Fantastic Mr. Fox, Roald Dahl).

### As-built deviations from spec

- `better-sqlite3` **^12.2.0** (spec ^9.6.0): v9 ships no Node 24 prebuilds.
- Docker base **node:20-slim + python3/make/g++** (spec alpine): no musl
  prebuilds; compiles from source on first build.
- New **`.dockerignore`** (node_modules, data, .git, .env): host `node_modules`
  shadowed the Linux install → `ERR_DLOPEN_FAILED: invalid ELF header`.
- `openlibrary.js`: legacy `bibkeys` first, **modern `/isbn/*.json` fallback**
  with author/work enrichment; normalizer handles both shapes. Legacy returns
  `{}` for valid ISBNs (2026); Windows Node cannot handshake OpenLibrary TLS
  (Linux/Docker fine).
- Spec example ISBN `9780140328721` resolves to **"Fantastic Mr. Fox"**, not
  "Matilda" (upstream data).
- `db.js` adds `searchCachedProducts()` / `browseByCategory()`; `server.js`
  wires the spec-structure `search`/`category` routes (no code given in spec).
- `docker-compose.yml`: dropped obsolete `version` key.
- `ecosystem.config.js`: minimal single-fork PM2 app (not specified in spec).
