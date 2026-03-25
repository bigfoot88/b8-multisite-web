const { createSiteBootstrap } = require('../lib/site-bootstrap');

function parseMetadata(value) {
  return value ? JSON.parse(value) : {};
}

function mapAsset(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    assetKey: row.asset_key,
    siteKey: row.site_key,
    sourceUrl: row.source_url,
    filename: row.filename,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    altText: row.alt_text,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createMediaRepository(db) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const insertAsset = db.prepare(`
    INSERT INTO media_assets (asset_key, site_key, source_url, filename, mime_type, storage_path, alt_text, metadata_json)
    VALUES (@assetKey, @siteKey, @sourceUrl, @filename, @mimeType, @storagePath, @altText, @metadataJson)
  `);
  const selectByKey = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?');
  const selectAll = db.prepare(`
    SELECT *
    FROM media_assets
    WHERE (@siteKey IS NULL OR site_key = @siteKey OR site_key IS NULL)
    ORDER BY CASE WHEN site_key IS NULL THEN 1 ELSE 0 END ASC, asset_key ASC
  `);

  return {
    createAsset({ assetKey, siteKey = null, sourceUrl = null, filename, mimeType, storagePath, altText = null, metadata = {} }) {
      if (siteKey !== null && siteKey !== undefined) {
        ensureSite(siteKey);
      }
      const payload = {
        assetKey,
        siteKey,
        sourceUrl,
        filename,
        mimeType,
        storagePath,
        altText,
        metadataJson: JSON.stringify(metadata),
      };
      const info = insertAsset.run(payload);
      return mapAsset(db.prepare('SELECT * FROM media_assets WHERE id = ?').get(info.lastInsertRowid));
    },
    findByAssetKey(assetKey) {
      return mapAsset(selectByKey.get(assetKey));
    },
    listAssets({ siteKey = null } = {}) {
      if (siteKey !== null && siteKey !== undefined) {
        assertValidSiteKey(siteKey);
      }
      return selectAll.all({ siteKey }).map(mapAsset);
    },
  };
}

module.exports = {
  createMediaRepository,
};
