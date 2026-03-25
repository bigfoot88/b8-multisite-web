const fs = require('node:fs');
const path = require('node:path');

const { sites } = require('../config/sites');

const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const allowedSiteKeysSql = sites.map((siteKey) => `'${siteKey}'`).join(', ');
const redirectRulesDefinition = `
CREATE TABLE redirect_rules (
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
)
`;

function ensureSiteSettingsValidationTriggers(db) {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS site_settings_site_key_insert_check
    BEFORE INSERT ON site_settings
    FOR EACH ROW
    WHEN NEW.site_key NOT IN (${allowedSiteKeysSql})
    BEGIN
      SELECT RAISE(ABORT, 'siteKey must be one of: ${sites.join(', ')}');
    END;

    CREATE TRIGGER IF NOT EXISTS site_settings_site_key_update_check
    BEFORE UPDATE OF site_key ON site_settings
    FOR EACH ROW
    WHEN NEW.site_key NOT IN (${allowedSiteKeysSql})
    BEGIN
      SELECT RAISE(ABORT, 'siteKey must be one of: ${sites.join(', ')}');
    END;
  `);
}

function ensureRedirectRulesDefault(db) {
  const row = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'redirect_rules'
  `).get();

  if (!row?.sql || row.sql.includes('status_code INTEGER NOT NULL DEFAULT 301')) {
    return;
  }

  db.exec(`
    ALTER TABLE redirect_rules RENAME TO redirect_rules_legacy;
    ${redirectRulesDefinition};
    INSERT INTO redirect_rules (id, site_key, source_path, source_query, target_path, status_code, is_active, created_at, updated_at)
    SELECT id, site_key, source_path, source_query, target_path, status_code, is_active, created_at, updated_at
    FROM redirect_rules_legacy;
    DROP TABLE redirect_rules_legacy;
    CREATE INDEX IF NOT EXISTS idx_redirect_rules_site_key ON redirect_rules(site_key, source_path);
  `);
}

function listTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function ensureNoDuplicateNormalizedSiteDomains(db) {
  const siteSettingsTable = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'site_settings'
  `).get();

  if (!siteSettingsTable) {
    return;
  }

  const columns = new Set(listTableColumns(db, 'site_settings'));

  if (!columns.has('site_key') || !columns.has('domain')) {
    return;
  }

  const duplicates = db.prepare(`
    SELECT
      lower(trim(domain)) AS normalized_domain,
      group_concat(site_key || ' (' || domain || ')', ', ') AS conflicts,
      COUNT(*) AS count
    FROM site_settings
    GROUP BY lower(trim(domain))
    HAVING COUNT(*) > 1
    ORDER BY normalized_domain ASC
  `).all();

  if (duplicates.length === 0) {
    return;
  }

  const details = duplicates
    .map(({ normalized_domain: normalizedDomain, conflicts }) => `${normalizedDomain || '(empty domain)'}: ${conflicts}`)
    .join('; ');

  const error = new Error(
    `Legacy site_settings rows contain duplicate normalized site domains. Resolve the conflicting site_settings rows before starting the app and rerun the migration. Conflicts: ${details}`,
  );
  error.code = 'LEGACY_DUPLICATE_SITE_DOMAINS';
  throw error;
}

function runMigrations(db) {
  ensureNoDuplicateNormalizedSiteDomains(db);
  db.exec(schemaSql);
  ensureSiteSettingsValidationTriggers(db);
  ensureRedirectRulesDefault(db);
  return db;
}

module.exports = {
  runMigrations,
};
