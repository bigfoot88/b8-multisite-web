const { createSiteBootstrap } = require('../lib/site-bootstrap');

function mapRule(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    sourcePath: row.source_path,
    sourceQuery: row.source_query,
    targetPath: row.target_path,
    statusCode: row.status_code,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createRedirectRepository(db) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const insertRule = db.prepare(`
    INSERT INTO redirect_rules (site_key, source_path, source_query, target_path, status_code, is_active)
    VALUES (@siteKey, @sourcePath, @sourceQuery, @targetPath, @statusCode, @isActive)
  `);
  const selectRules = db.prepare('SELECT * FROM redirect_rules WHERE site_key = ? ORDER BY source_path ASC, source_query ASC');

  return {
    createRule({ siteKey, sourcePath, sourceQuery = '', targetPath, statusCode = 301, isActive = true }) {
      ensureSite(siteKey);
      const info = insertRule.run({
        siteKey,
        sourcePath,
        sourceQuery,
        targetPath,
        statusCode,
        isActive: isActive ? 1 : 0,
      });
      return mapRule(db.prepare('SELECT * FROM redirect_rules WHERE id = ?').get(info.lastInsertRowid));
    },
    listRules(siteKey) {
      assertValidSiteKey(siteKey);
      return selectRules.all(siteKey).map(mapRule);
    },
  };
}

module.exports = {
  createRedirectRepository,
};
