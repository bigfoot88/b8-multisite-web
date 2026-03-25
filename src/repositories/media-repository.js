const path = require('node:path');

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
    publicUrl: row.source_url || `/uploads/${path.basename(row.storage_path)}`,
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
  const selectById = db.prepare('SELECT * FROM media_assets WHERE id = ?');
  const updateAssetStatement = db.prepare(`
    UPDATE media_assets
    SET site_key = @siteKey,
        source_url = @sourceUrl,
        filename = @filename,
        mime_type = @mimeType,
        storage_path = @storagePath,
        alt_text = @altText,
        metadata_json = @metadataJson,
        updated_at = CURRENT_TIMESTAMP
    WHERE asset_key = @assetKey
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
      return mapAsset(selectById.get(info.lastInsertRowid));
    },
    updateAsset(assetKey, { siteKey = null, sourceUrl = null, filename, mimeType, storagePath, altText = null, metadata = {} }) {
      if (siteKey === '') {
        throw new Error('siteKey must be one of: dma, bigfoot');
      }
      if (siteKey !== null && siteKey !== undefined) {
        ensureSite(siteKey);
      }
      updateAssetStatement.run({
        assetKey,
        siteKey: siteKey || null,
        sourceUrl,
        filename,
        mimeType,
        storagePath,
        altText,
        metadataJson: JSON.stringify(metadata),
      });
      return mapAsset(selectByKey.get(assetKey));
    },
    findByAssetKey(assetKey) {
      return mapAsset(selectByKey.get(assetKey));
    },
    findById(id) {
      return mapAsset(selectById.get(id));
    },
    listAssets({ siteKey = null } = {}) {
      if (siteKey === '') {
        throw new Error('siteKey must be one of: dma, bigfoot');
      }
      if (siteKey !== null && siteKey !== undefined) {
        assertValidSiteKey(siteKey);
      }

      const statement = siteKey
        ? db.prepare(`
            SELECT *
            FROM media_assets
            WHERE site_key = @siteKey OR site_key IS NULL
            ORDER BY updated_at DESC, id DESC
          `)
        : db.prepare('SELECT * FROM media_assets ORDER BY updated_at DESC, id DESC');

      return (siteKey ? statement.all({ siteKey }) : statement.all()).map(mapAsset);
    },
  };
}

module.exports = {
  createMediaRepository,
};
