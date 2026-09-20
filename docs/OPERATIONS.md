# B-Pls Operations Guide (v1.0.0)

## Deploy: local

```bash
npm install
npm run migrate   # builds ./data/bpls.db from migrations/0001_init.sql (auto-runs on boot too)
npm run seed      # idempotent: INSERT OR IGNORE for Shop A + Gig4Gig keys
npm start         # prod defaults from .env (PORT 4011)
npm run dev       # watch mode
```

`src/db.js` auto-migrates on first `getDatabase()` call, so a fresh checkout
works with just `npm install && npm run seed && npm start`. Keep `node_modules/`,
`data/*.db*`, `.env` out of git (see `.gitignore`).

## Deploy: Docker (production-parity)

```bash
docker compose up --build -d
docker compose exec bpls npm run seed   # required: volume starts with empty DB
curl http://localhost:4011/health
```

Notes:

- Base image is `node:20-slim` **plus `python3 make g++`** — better-sqlite3 ships
  no prebuilt binary for this target, so it compiles during `npm ci` (~3 min
  first build; cached afterwards).
- `.dockerignore` excludes `node_modules`, `data`, `.git`, `.env`. Without it,
  host (Windows) `node_modules` shadows the Linux install and the container
  crash-loops with `ERR_DLOPEN_FAILED: invalid ELF header`.
- The `bpls_data` volume persists `bpls.db` across restarts. `docker compose down`
  keeps it; `docker volume rm b-pls_bpls_data` wipes it (re-seed after).
- Only `PORT`, `DATABASE_PATH`, `NODE_ENV`, `USER_AGENT` are set in
  `docker-compose.yml`; everything else falls back to `src/config.js` defaults.

## Deploy: PM2

`ecosystem.config.js` ships a single-fork app (`src/server.js`, PORT 4011).
`pm2 start ecosystem.config.js && pm2 save`.

## Configuration

Copy `.env.example` → `.env` and set a real contact in `USER_AGENT`
(Open\*Facts policy, e.g. `B-Pls/1.0 (ops@your-domain.com)`). Never commit `.env`.

| Variable | Default | Notes |
| :--- | :--- | :--- |
| `PORT` / `NODE_ENV` / `LOG_LEVEL` | `4011` / `production` / `info` | `LOG_LEVEL=debug` for troubleshooting |
| `DATABASE_PATH` | `./data/bpls.db` | WAL mode; back up the file hot — SQLite allows it |
| `MEMORY_CACHE_TTL` / `SQLITE_CACHE_TTL` / `NEGATIVE_CACHE_TTL` | `3600` / `2592000` / `86400` | seconds |
| `OFF_URL` `OBF_URL` `OPFF_URL` `OPF_URL` `OPENLIBRARY_URL` | world.\* hosts | override for mirrors/staging |
| `UPSTREAM_TIMEOUT_MS` | `10000` | per-call AbortController timeout |
| `MAX_BATCH_SIZE` | `50` | enforced by route schema (400 over) |
| `DEFAULT_SEARCH_LIMIT` / `MAX_SEARCH_LIMIT` | `20` / `100` | |

## Tenants

```bash
# add a project (keys must be unique)
sqlite3 data/bpls.db "INSERT INTO projects (name, api_key, default_sources, created_at, updated_at)
VALUES ('Warehouse','<random-key>','food,products',strftime('%s','now')*1000,strftime('%s','now')*1000);"
# disable a project
sqlite3 data/bpls.db "UPDATE projects SET is_active = 0 WHERE api_key = '<key>';"
```

`default_sources` is informational in v1.0.0 (per-request `?sources=` overrides);
`is_active = 0` immediately 401s the key.

## Maintenance

- **Expired cache:** `purgeExpiredProducts()` exists in `src/db.js` but has no
  scheduler — run it via a cron/PM2 tick or `node -e "import('./src/db.js').then(m => (m.getDatabase(), console.log('purged', m.purgeExpiredProducts())))"`.
- **Force-refresh a barcode:** `GET /barcode/:code?refresh=true` (bypasses both tiers).
- **Backups:** copy `data/bpls.db` (+ `-wal`/`-shm` if present); restore = copy back + restart.
- **Logs:** pino on stdout; `docker logs bpls --tail 50`; `responseTime` per request
  tells the tier (~2 ms memory, ~14 ms SQLite, 300 ms+ upstream).

## Troubleshooting

| Symptom | Cause / fix |
| :--- | :--- |
| `npm install` fails on `better-sqlite3` (Windows) | Needs VS Build Tools — avoided by using better-sqlite3 **v12** (prebuilt for Node 24). `npm audit` shows 2 high vulns from the tree; `npm audit fix --force` at your risk. |
| Docker `ERR_DLOPEN_FAILED: invalid ELF header` | Host `node_modules` copied into image — keep `.dockerignore`. |
| Docker build `node-gyp`/Python errors | Rebuild with the toolchain line in `Dockerfile` (already present). |
| `EADDRINUSE` on 4011 | Local server and container collide — stop one (`docker compose down` or kill node). |
| ISBN lookups 404/timeout on **Windows Node** | OpenLibrary's TLS handshake hangs Windows Node fetch (verified: curl OK, Node aborts at timeout). Linux/Docker unaffected. Workaround: run via Docker, or `?refresh=true` after deploying. |
| `{"error":"Invalid or inactive API Key"}` in container | Fresh volume = empty `projects` — run `docker compose exec bpls npm run seed`. |
| Empty search/category results | They query the **local cache only** — look up barcodes first to populate it. |
