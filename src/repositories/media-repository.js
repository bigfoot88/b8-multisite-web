const path = require('node:path');

const { createAdminValidationError } = require('../lib/admin-errors');
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
  const selectReferenceSites = db.prepare(`
    SELECT DISTINCT site_key
    FROM (
      SELECT site_key, brochure_media_id AS media_id FROM products WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, attachment_media_id AS media_id FROM products WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, attachment_media_id AS media_id FROM solutions WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, attachment_media_id AS media_id FROM pages WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, hero_media_id AS media_id FROM news_articles WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, attachment_media_id AS media_id FROM case_studies WHERE deleted_at IS NULL
      UNION ALL
      SELECT site_key, media_asset_id AS media_id FROM site_sections
    ) AS references_by_site
    WHERE media_id = ?
  `);
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

  function assertWritableSiteKey(siteKey) {
    try {
      ensureSite(siteKey);
    } catch (error) {
      if (error?.message?.startsWith('siteKey must be one of:')) {
        throw createAdminValidationError('站点标识无效，请重新选择。', 'siteKey validation error');
      }

      throw error;
    }
  }

  function assertRebindKeepsReferencesValid(current, nextSiteKey) {
    if (!current || nextSiteKey === null || nextSiteKey === undefined || nextSiteKey === current.site_key) {
      return;
    }

    const incompatibleReference = selectReferenceSites
      .all(current.id)
      .find((reference) => reference.site_key !== null && reference.site_key !== nextSiteKey);

    if (incompatibleReference) {
      throw createAdminValidationError('当前素材已被其他站点内容引用，不能迁移到该站点。', 'media-site-assignment-conflict');
    }
  }

  return {
    createAsset({ assetKey, siteKey = null, sourceUrl = null, filename, mimeType, storagePath, altText = null, metadata = {} }) {
      if (siteKey !== null && siteKey !== undefined) {
        assertWritableSiteKey(siteKey);
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
      const current = selectByKey.get(assetKey);
      if (siteKey === '') {
        throw createAdminValidationError('站点标识无效，请重新选择。', 'siteKey validation error');
      }
      if (siteKey !== null && siteKey !== undefined) {
        assertWritableSiteKey(siteKey);
      }
      assertRebindKeepsReferencesValid(current, siteKey || null);
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
