const { createSiteBootstrap } = require('../lib/site-bootstrap');

function parseJson(value) {
  return value ? JSON.parse(value) : {};
}

function mapSiteSettings(row) {
  if (!row) {
    return null;
  }

  return {
    siteKey: row.site_key,
    brandName: row.brand_name,
    domain: row.domain,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactAddress: row.contact_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSection(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    sectionKey: row.section_key,
    heading: row.heading,
    subheading: row.subheading,
    body: row.body,
    mediaAssetId: row.media_asset_id,
    config: parseJson(row.config_json),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNavigation(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    label: row.label,
    href: row.href,
    parentId: row.parent_id,
    position: row.position,
    kind: row.kind,
    isVisible: Boolean(row.is_visible),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeConfig(config) {
  if (!config) {
    return {};
  }

  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }

  return config;
}

function createSiteRepository(db) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const upsertSiteSettingsStatement = db.prepare(`
    INSERT INTO site_settings (site_key, brand_name, domain, seo_title, seo_description, contact_email, contact_phone, contact_address)
    VALUES (@siteKey, @brandName, @domain, @seoTitle, @seoDescription, @contactEmail, @contactPhone, @contactAddress)
    ON CONFLICT(site_key) DO UPDATE SET
      brand_name = excluded.brand_name,
      domain = excluded.domain,
      seo_title = excluded.seo_title,
      seo_description = excluded.seo_description,
      contact_email = excluded.contact_email,
      contact_phone = excluded.contact_phone,
      contact_address = excluded.contact_address,
      updated_at = CURRENT_TIMESTAMP
  `);
  const upsertSectionStatement = db.prepare(`
    INSERT INTO site_sections (site_key, section_key, heading, subheading, body, media_asset_id, config_json, is_published, published_at, sort_order)
    VALUES (@siteKey, @sectionKey, @heading, @subheading, @body, @mediaAssetId, @configJson, @isPublished, @publishedAt, @sortOrder)
    ON CONFLICT(site_key, section_key) DO UPDATE SET
      heading = excluded.heading,
      subheading = excluded.subheading,
      body = excluded.body,
      media_asset_id = excluded.media_asset_id,
      config_json = excluded.config_json,
      is_published = excluded.is_published,
      published_at = excluded.published_at,
      sort_order = excluded.sort_order,
      updated_at = CURRENT_TIMESTAMP
  `);
  const clearNavigation = db.prepare('DELETE FROM navigation_items WHERE site_key = ?');
  const insertNavigation = db.prepare(`
    INSERT INTO navigation_items (site_key, label, href, parent_id, position, kind, is_visible)
    VALUES (@siteKey, @label, @href, @parentId, @position, @kind, @isVisible)
  `);
  const updateNavigationParent = db.prepare('UPDATE navigation_items SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const selectSettings = db.prepare('SELECT * FROM site_settings WHERE site_key = ?');
  const selectAllSettings = db.prepare('SELECT * FROM site_settings ORDER BY site_key ASC');
  const selectSettingsByDomain = db.prepare('SELECT * FROM site_settings WHERE domain = ?');
  const selectSections = db.prepare('SELECT * FROM site_sections WHERE site_key = ? ORDER BY sort_order ASC, section_key ASC');
  const selectPublishedSections = db.prepare('SELECT * FROM site_sections WHERE site_key = ? AND is_published = 1 ORDER BY sort_order ASC, section_key ASC');
  const selectSection = db.prepare('SELECT * FROM site_sections WHERE site_key = ? AND section_key = ?');
  const selectHomepageBanners = db.prepare(`
    SELECT *
    FROM site_sections
    WHERE site_key = ?
      AND section_key IN ('hero', 'hero-banner')
      AND is_published = 1
    ORDER BY sort_order ASC, section_key ASC
  `);
  const selectNavigation = db.prepare('SELECT * FROM navigation_items WHERE site_key = ? ORDER BY position ASC, id ASC');
  const selectNavigationItem = db.prepare('SELECT * FROM navigation_items WHERE site_key = ? AND id = ?');
  const selectNavigationItemById = db.prepare('SELECT * FROM navigation_items WHERE id = ?');
  const updateNavigationItemStatement = db.prepare(`
    UPDATE navigation_items
    SET label = @label,
        href = @href,
        parent_id = @parentId,
        position = @position,
        kind = @kind,
        is_visible = @isVisible,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND site_key = @siteKey
  `);
  const deleteNavigationItemStatement = db.prepare('DELETE FROM navigation_items WHERE id = ? AND site_key = ?');

  const saveNavigationItemTransaction = db.transaction((input) => {
    ensureSite(input.siteKey);
    const parentId = normalizeInteger(input.parentId);

    if (parentId) {
      const parent = selectNavigationItemById.get(parentId);
      if (!parent || parent.site_key !== input.siteKey) {
        throw new Error('Navigation parent must belong to the same site');
      }
      if (input.id && Number(input.id) === Number(parentId)) {
        throw new Error('Navigation item cannot be its own parent');
      }
    }

    if (input.id) {
      updateNavigationItemStatement.run({
        id: input.id,
        siteKey: input.siteKey,
        label: input.label,
        href: input.href,
        parentId,
        position: normalizeInteger(input.position, 0),
        kind: input.kind || 'link',
        isVisible: input.isVisible === false ? 0 : 1,
      });
      return mapNavigation(selectNavigationItem.get(input.siteKey, input.id));
    }

    const info = insertNavigation.run({
      siteKey: input.siteKey,
      label: input.label,
      href: input.href,
      parentId,
      position: normalizeInteger(input.position, 0),
      kind: input.kind || 'link',
      isVisible: input.isVisible === false ? 0 : 1,
    });
    return mapNavigation(selectNavigationItem.get(input.siteKey, info.lastInsertRowid));
  });

  return {
    upsertSiteSettings({ siteKey, brandName, domain, seoTitle = null, seoDescription = null, contactEmail = null, contactPhone = null, contactAddress = null }) {
      assertValidSiteKey(siteKey);
      upsertSiteSettingsStatement.run({
        siteKey,
        brandName,
        domain,
        seoTitle,
        seoDescription,
        contactEmail,
        contactPhone,
        contactAddress,
      });
      return mapSiteSettings(selectSettings.get(siteKey));
    },
    listSiteSettings() {
      return selectAllSettings.all().map(mapSiteSettings);
    },
    getSiteSettings(siteKey) {
      assertValidSiteKey(siteKey);
      return mapSiteSettings(selectSettings.get(siteKey));
    },
    getSiteSettingsByDomain(domain) {
      if (!domain) {
        return null;
      }
      return mapSiteSettings(selectSettingsByDomain.get(domain));
    },
    saveSection({ siteKey, sectionKey, heading = null, subheading = null, body = null, mediaAssetId = null, config = {}, isPublished = true, publishedAt = null, sortOrder = 0 }) {
      ensureSite(siteKey);
      upsertSectionStatement.run({
        siteKey,
        sectionKey,
        heading,
        subheading,
        body,
        mediaAssetId: normalizeInteger(mediaAssetId),
        configJson: JSON.stringify(normalizeConfig(config)),
        isPublished: isPublished ? 1 : 0,
        publishedAt: isPublished ? (publishedAt || new Date().toISOString()) : null,
        sortOrder: normalizeInteger(sortOrder, 0),
      });
      return mapSection(selectSection.get(siteKey, sectionKey));
    },
    getSection(siteKey, sectionKey) {
      assertValidSiteKey(siteKey);
      return mapSection(selectSection.get(siteKey, sectionKey));
    },
    listSections(siteKey) {
      assertValidSiteKey(siteKey);
      return selectSections.all(siteKey).map(mapSection);
    },
    listPublishedSections(siteKey) {
      assertValidSiteKey(siteKey);
      return selectPublishedSections.all(siteKey).map(mapSection);
    },
    listHomepageBanners(siteKey) {
      assertValidSiteKey(siteKey);
      return selectHomepageBanners.all(siteKey).map(mapSection);
    },
    replaceNavigation(siteKey, items) {
      assertValidSiteKey(siteKey);
      const transaction = db.transaction((rows) => {
        ensureSite(siteKey);
        clearNavigation.run(siteKey);
        const insertedRows = [];
        const legacyIdMap = new Map();
        const keyMap = new Map();

        rows.forEach((item, index) => {
          const info = insertNavigation.run({
            siteKey,
            label: item.label,
            href: item.href,
            parentId: null,
            position: item.position ?? index,
            kind: item.kind ?? 'link',
            isVisible: item.isVisible === false ? 0 : 1,
          });
          insertedRows.push({ item, id: info.lastInsertRowid });
          if (item.id !== undefined && item.id !== null) {
            legacyIdMap.set(item.id, info.lastInsertRowid);
          }
          if (item.key) {
            keyMap.set(item.key, info.lastInsertRowid);
          }
        });

        insertedRows.forEach(({ item, id }) => {
          let parentId = null;

          if (item.parentKey) {
            parentId = keyMap.get(item.parentKey) ?? null;
          } else if (item.parentId !== undefined && item.parentId !== null) {
            parentId = legacyIdMap.get(item.parentId) ?? null;
          }

          if (parentId) {
            updateNavigationParent.run(parentId, id);
          }
        });
      });
      transaction(items);
      return this.listNavigation(siteKey);
    },
    saveNavigationItem(input) {
      return saveNavigationItemTransaction(input);
    },
    getNavigationItem(siteKey, id) {
      assertValidSiteKey(siteKey);
      return mapNavigation(selectNavigationItem.get(siteKey, id));
    },
    deleteNavigationItem(siteKey, id) {
      assertValidSiteKey(siteKey);
      deleteNavigationItemStatement.run(id, siteKey);
    },
    listNavigation(siteKey) {
      assertValidSiteKey(siteKey);
      return selectNavigation.all(siteKey).map(mapNavigation);
    },
  };
}

module.exports = {
  createSiteRepository,
};
