-- ─────────────────────────────────────────────
-- 1. Projects (Tenants)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    default_sources TEXT DEFAULT 'food,beauty,pet,products,books',
    user_agent_suffix TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);

-- ─────────────────────────────────────────────
-- 2. Product Cache
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT NOT NULL,
    barcode_type TEXT,
    source TEXT NOT NULL,
    found INTEGER DEFAULT 1,
    product_data TEXT NOT NULL,
    raw_upstream TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(barcode, source)
);

CREATE INDEX IF NOT EXISTS idx_cache_barcode ON product_cache(barcode);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON product_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_source ON product_cache(source);

-- ─────────────────────────────────────────────
-- 3. Usage Log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    barcode TEXT,
    query TEXT,
    found INTEGER,
    cache_hit TEXT,
    upstream TEXT,
    upstream_calls INTEGER DEFAULT 0,
    duration_ms INTEGER,
    client_ip TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_log(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_barcode ON usage_log(project_id, barcode);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_log(created_at);

-- ─────────────────────────────────────────────
-- 4. Daily Summary
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_lookups INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    upstream_calls INTEGER DEFAULT 0,
    products_found INTEGER DEFAULT 0,
    products_not_found INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_summary_project ON daily_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_summary_date ON daily_summary(date);
