PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'superadmin',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  site_key TEXT PRIMARY KEY CHECK (site_key IN ('dma', 'bigfoot')),
  brand_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS navigation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  parent_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'link',
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(parent_id) REFERENCES navigation_items(id) ON DELETE CASCADE,
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_key TEXT NOT NULL UNIQUE,
  site_key TEXT,
  source_url TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS site_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  heading TEXT,
  subheading TEXT,
  body TEXT,
  media_asset_id INTEGER,
  config_json TEXT NOT NULL DEFAULT '{}',
  is_published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, section_key),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  parent_id INTEGER,
  path TEXT NOT NULL,
  slug TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  attachment_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft', 'published', 'archived')),
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, path),
  FOREIGN KEY(parent_id) REFERENCES pages(id) ON DELETE SET NULL,
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(attachment_media_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  brochure_media_id INTEGER,
  attachment_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft', 'published', 'archived')),
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, slug),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(brochure_media_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY(attachment_media_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  attachment_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft', 'published', 'archived')),
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, slug),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(attachment_media_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS news_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  hero_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft', 'published', 'archived')),
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, slug),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(hero_media_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  attachment_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft', 'published', 'archived')),
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, slug),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE,
  FOREIGN KEY(attachment_media_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS redirect_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_query TEXT NOT NULL DEFAULT '',
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_key, source_path, source_query),
  FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navigation_site_key ON navigation_items(site_key, position);
CREATE INDEX IF NOT EXISTS idx_site_sections_site_key ON site_sections(site_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_pages_site_key ON pages(site_key, publish_state, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_site_key ON products(site_key, publish_state, sort_order);
CREATE INDEX IF NOT EXISTS idx_solutions_site_key ON solutions(site_key, publish_state, sort_order);
CREATE INDEX IF NOT EXISTS idx_news_articles_site_key ON news_articles(site_key, publish_state, sort_order);
CREATE INDEX IF NOT EXISTS idx_case_studies_site_key ON case_studies(site_key, publish_state, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_assets_site_key ON media_assets(site_key, filename);
CREATE INDEX IF NOT EXISTS idx_redirect_rules_site_key ON redirect_rules(site_key, source_path);
