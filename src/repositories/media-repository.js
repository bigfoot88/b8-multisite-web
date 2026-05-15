const fs = require('node:fs');
const path = require('node:path');

const { createAdminValidationError } = require('../lib/admin-errors');
const {
  buildPublicMediaPath,
  normalizeRelativeMediaPath,
  relativePathFromSourceUrl,
  resolveManagedMediaRelativePath,
} = require('../lib/media-paths');
const { createSiteBootstrap } = require('../lib/site-bootstrap');

function parseMetadata(value) {
  return value ? JSON.parse(value) : {};
}

function mapAsset(row, uploadRoot = null) {
  if (!row) {
    return null;
  }

  const sourceRelativePath = relativePathFromSourceUrl(row.source_url);
  const relativePath = sourceRelativePath || (!row.source_url
    ? resolveManagedMediaRelativePath({
      storagePath: row.storage_path,
      uploadRoot,
    })
    : null);
  const readableStoragePath = resolveReadableStoragePath(row.storage_path, relativePath, uploadRoot);
  const isReadable = relativePath ? (readableStoragePath ? true : (uploadRoot ? false : null)) : true;

  return {
    id: row.id,
    assetKey: row.asset_key,
    siteKey: row.site_key,
    sourceUrl: row.source_url,
    filename: row.filename,
    mimeType: row.mime_type,
    storagePath: readableStoragePath || row.storage_path,
    altText: row.alt_text,
    metadata: parseMetadata(row.metadata_json),
    publicUrl: relativePath ? buildPublicMediaPath(relativePath) : (row.source_url || null),
    isReadable,
    relativePath,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveReadableStoragePath(storagePath, relativePath, uploadRoot = null) {
  if (storagePath && fs.existsSync(storagePath)) {
    return storagePath;
  }

  if (!uploadRoot || !relativePath) {
    return null;
  }

  const fallbackPath = path.join(uploadRoot, ...relativePath.split('/'));
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }

  return null;
}

function createMediaRepository(db, { uploadRoot = null } = {}) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const insertAsset = db.prepare(`
    INSERT INTO media_assets (asset_key, site_key, source_url, filename, mime_type, storage_path, alt_text, metadata_json)
    VALUES (@assetKey, @siteKey, @sourceUrl, @filename, @mimeType, @storagePath, @altText, @metadataJson)
  `);
  const selectByKey = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?');
  const selectById = db.prepare('SELECT * FROM media_assets WHERE id = ?');
  const selectAll = db.prepare('SELECT * FROM media_assets ORDER BY id ASC');
  const selectReferenceSites = db.prepare(`
      SELECT DISTINCT site_key
      FROM (
        SELECT site_key, home_banner_media_id AS media_id FROM site_settings
        UNION ALL
        SELECT site_key, home_banner_secondary_media_id AS media_id FROM site_settings
        UNION ALL
        SELECT site_key, home_feature_media_id AS media_id FROM site_settings
        UNION ALL
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
  const selectPublishedPublicReference = db.prepare(`
    SELECT 1
    FROM (
      SELECT site_key FROM site_settings
      WHERE home_banner_media_id = @assetId
         OR home_banner_secondary_media_id = @assetId
         OR home_feature_media_id = @assetId
      UNION
      SELECT site_key FROM products WHERE deleted_at IS NULL AND publish_state = 'published' AND (brochure_media_id = @assetId OR attachment_media_id = @assetId)
      UNION
      SELECT site_key FROM solutions WHERE deleted_at IS NULL AND publish_state = 'published' AND attachment_media_id = @assetId
      UNION
      SELECT site_key FROM pages WHERE deleted_at IS NULL AND publish_state = 'published' AND attachment_media_id = @assetId
      UNION
      SELECT site_key FROM news_articles WHERE deleted_at IS NULL AND publish_state = 'published' AND hero_media_id = @assetId
      UNION
      SELECT site_key FROM case_studies WHERE deleted_at IS NULL AND publish_state = 'published' AND attachment_media_id = @assetId
      UNION
      SELECT site_key FROM site_sections WHERE is_published = 1 AND media_asset_id = @assetId
    ) AS public_references
    WHERE site_key = @siteKey
    LIMIT 1
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

  function mapRowToAsset(row) {
    return mapAsset(row, uploadRoot);
  }

  function findManagedAssetByRelativePath(relativePath) {
    const normalizedRelativePath = normalizeRelativeMediaPath(relativePath);
    if (!normalizedRelativePath) {
      return null;
    }

    for (const row of selectAll.all()) {
      const asset = mapRowToAsset(row);
      if (asset?.relativePath === normalizedRelativePath) {
        return asset;
      }
    }

    return null;
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
      return mapRowToAsset(selectById.get(info.lastInsertRowid));
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
      return mapRowToAsset(selectByKey.get(assetKey));
    },
    findByAssetKey(assetKey) {
      return mapRowToAsset(selectByKey.get(assetKey));
    },
    findById(id) {
      return mapRowToAsset(selectById.get(id));
    },
    findManagedAssetByRelativePath,
    findPublicAssetByPath(siteKey, relativePath) {
      if (!siteKey) {
        return null;
      }

      assertValidSiteKey(siteKey);
      const asset = findManagedAssetByRelativePath(relativePath);
      if (!asset) {
        return null;
      }
      if (asset.siteKey !== null && asset.siteKey !== siteKey) {
        return null;
      }
      if (!selectPublishedPublicReference.get({ assetId: asset.id, siteKey })) {
        return null;
      }

      return asset;
    },
    findByIds(ids = []) {
      const normalizedIds = [...new Set(ids
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0))];

      if (normalizedIds.length === 0) {
        return [];
      }

      const placeholders = normalizedIds.map(() => '?').join(', ');
      const statement = db.prepare(`
        SELECT *
        FROM media_assets
        WHERE id IN (${placeholders})
        ORDER BY id ASC
      `);
      return statement.all(...normalizedIds).map(mapRowToAsset);
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

      return (siteKey ? statement.all({ siteKey }) : statement.all()).map(mapRowToAsset);
    },
  };
}

module.exports = {
  createMediaRepository,
};
