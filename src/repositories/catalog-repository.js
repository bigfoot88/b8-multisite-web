const { createAdminConflictError, createAdminValidationError } = require('../lib/admin-errors');
const { createSiteBootstrap } = require('../lib/site-bootstrap');

const collections = {
  products: {
    table: 'products',
    selectFields: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'brochure_media_id', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'deleted_at', 'created_at', 'updated_at'],
    orderBy: {
      default: 'sort_order ASC, slug ASC',
      title_desc: 'title DESC, sort_order ASC, slug ASC',
      updated_desc: 'updated_at DESC, id DESC',
    },
  },
  solutions: {
    table: 'solutions',
    selectFields: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'deleted_at', 'created_at', 'updated_at'],
    orderBy: {
      default: 'sort_order ASC, slug ASC',
      title_desc: 'title DESC, sort_order ASC, slug ASC',
      updated_desc: 'updated_at DESC, id DESC',
    },
  },
  pages: {
    table: 'pages',
    selectFields: ['id', 'site_key', 'parent_id', 'path', 'slug', 'title', 'summary', 'body_html', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'deleted_at', 'created_at', 'updated_at'],
    orderBy: {
      default: 'sort_order ASC, path ASC',
      title_desc: 'title DESC, sort_order ASC, path ASC',
      updated_desc: 'updated_at DESC, id DESC',
    },
  },
  news: {
    table: 'news_articles',
    selectFields: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'hero_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'deleted_at', 'created_at', 'updated_at'],
    orderBy: {
      default: 'sort_order ASC, published_at IS NULL, published_at DESC, slug ASC',
      title_desc: 'title DESC, sort_order ASC, slug ASC',
      updated_desc: 'updated_at DESC, id DESC',
    },
  },
  cases: {
    table: 'case_studies',
    selectFields: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'attachment_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'deleted_at', 'created_at', 'updated_at'],
    orderBy: {
      default: 'sort_order ASC, slug ASC',
      title_desc: 'title DESC, sort_order ASC, slug ASC',
      updated_desc: 'updated_at DESC, id DESC',
    },
  },
};

function mapRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    parentId: row.parent_id ?? null,
    path: row.path ?? null,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyHtml: row.body_html,
    heroMediaId: row.hero_media_id ?? null,
    brochureMediaId: row.brochure_media_id ?? null,
    attachmentMediaId: row.attachment_media_id ?? null,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    sortOrder: row.sort_order,
    publishState: row.publish_state,
    publishedAt: row.published_at,
    deletedAt: row.deleted_at,
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

function normalizePublishState(value, fallback = 'draft') {
  const nextValue = value || fallback;
  if (!['draft', 'published', 'archived'].includes(nextValue)) {
    return fallback;
  }
  return nextValue;
}

function preferInputValue(value, fallback) {
  return value === undefined || value === null ? fallback : value;
}

function deriveSlugFromPath(value) {
  const parts = String(value || '').split('/').filter(Boolean);
  return parts.at(-1) || 'home';
}

function normalizePagePath(value) {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

function normalizeRecord(type, input, existing = null) {
  const publishState = normalizePublishState(input.publishState, existing?.publishState || 'draft');
  const publishedAt = publishState === 'published'
    ? (input.publishedAt || existing?.publishedAt || new Date().toISOString())
    : null;

  if (type === 'pages') {
    const pathValue = normalizePagePath(preferInputValue(input.path, existing?.path));
    return {
      siteKey: input.siteKey || existing?.siteKey,
      parentId: normalizeInteger(input.parentId, existing?.parentId ?? null),
      path: pathValue,
      slug: preferInputValue(input.slug, existing?.slug) || deriveSlugFromPath(pathValue),
      title: input.title || existing?.title || '',
      summary: input.summary ?? existing?.summary ?? null,
      bodyHtml: input.bodyHtml ?? existing?.bodyHtml ?? null,
      attachmentMediaId: normalizeInteger(input.attachmentMediaId, existing?.attachmentMediaId ?? null),
      seoTitle: input.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: input.seoDescription ?? existing?.seoDescription ?? null,
      sortOrder: normalizeInteger(input.sortOrder, existing?.sortOrder ?? 100),
      publishState,
      publishedAt,
      deletedAt: existing?.deletedAt ?? null,
    };
  }

  if (type === 'products') {
    return {
      siteKey: input.siteKey || existing?.siteKey,
      slug: preferInputValue(input.slug, existing?.slug),
      title: input.title || existing?.title || '',
      summary: input.summary ?? existing?.summary ?? null,
      bodyHtml: input.bodyHtml ?? existing?.bodyHtml ?? null,
      brochureMediaId: normalizeInteger(input.brochureMediaId, existing?.brochureMediaId ?? null),
      attachmentMediaId: normalizeInteger(input.attachmentMediaId, existing?.attachmentMediaId ?? null),
      seoTitle: input.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: input.seoDescription ?? existing?.seoDescription ?? null,
      sortOrder: normalizeInteger(input.sortOrder, existing?.sortOrder ?? 100),
      publishState,
      publishedAt,
      deletedAt: existing?.deletedAt ?? null,
    };
  }

  if (type === 'news') {
    return {
      siteKey: input.siteKey || existing?.siteKey,
      slug: preferInputValue(input.slug, existing?.slug),
      title: input.title || existing?.title || '',
      summary: input.summary ?? existing?.summary ?? null,
      bodyHtml: input.bodyHtml ?? existing?.bodyHtml ?? null,
      heroMediaId: normalizeInteger(input.heroMediaId, existing?.heroMediaId ?? null),
      seoTitle: input.seoTitle ?? existing?.seoTitle ?? null,
      seoDescription: input.seoDescription ?? existing?.seoDescription ?? null,
      sortOrder: normalizeInteger(input.sortOrder, existing?.sortOrder ?? 100),
      publishState,
      publishedAt,
      deletedAt: existing?.deletedAt ?? null,
    };
  }

  return {
    siteKey: input.siteKey || existing?.siteKey,
    slug: preferInputValue(input.slug, existing?.slug),
    title: input.title || existing?.title || '',
    summary: input.summary ?? existing?.summary ?? null,
    bodyHtml: input.bodyHtml ?? existing?.bodyHtml ?? null,
    attachmentMediaId: normalizeInteger(input.attachmentMediaId, existing?.attachmentMediaId ?? null),
    seoTitle: input.seoTitle ?? existing?.seoTitle ?? null,
    seoDescription: input.seoDescription ?? existing?.seoDescription ?? null,
    sortOrder: normalizeInteger(input.sortOrder, existing?.sortOrder ?? 100),
    publishState,
    publishedAt,
    deletedAt: existing?.deletedAt ?? null,
  };
}

function buildInsertStatement(db, type) {
  if (type === 'products') {
    return db.prepare(`
      INSERT INTO products (site_key, slug, title, summary, body_html, brochure_media_id, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
      VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @brochureMediaId, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
    `);
  }
  if (type === 'solutions') {
    return db.prepare(`
      INSERT INTO solutions (site_key, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
      VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
    `);
  }
  if (type === 'pages') {
    return db.prepare(`
      INSERT INTO pages (site_key, parent_id, path, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
      VALUES (@siteKey, @parentId, @path, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
    `);
  }
  if (type === 'news') {
    return db.prepare(`
      INSERT INTO news_articles (site_key, slug, title, summary, body_html, hero_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
      VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @heroMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
    `);
  }
  return db.prepare(`
    INSERT INTO case_studies (site_key, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
}

function buildUpdateStatement(db, type) {
  if (type === 'products') {
    return db.prepare(`
      UPDATE products
      SET slug = @slug,
          title = @title,
          summary = @summary,
          body_html = @bodyHtml,
          brochure_media_id = @brochureMediaId,
          attachment_media_id = @attachmentMediaId,
          seo_title = @seoTitle,
          seo_description = @seoDescription,
          sort_order = @sortOrder,
          publish_state = @publishState,
          published_at = @publishedAt,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND site_key = @siteKey
    `);
  }
  if (type === 'solutions') {
    return db.prepare(`
      UPDATE solutions
      SET slug = @slug,
          title = @title,
          summary = @summary,
          body_html = @bodyHtml,
          attachment_media_id = @attachmentMediaId,
          seo_title = @seoTitle,
          seo_description = @seoDescription,
          sort_order = @sortOrder,
          publish_state = @publishState,
          published_at = @publishedAt,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND site_key = @siteKey
    `);
  }
  if (type === 'pages') {
    return db.prepare(`
      UPDATE pages
      SET parent_id = @parentId,
          path = @path,
          slug = @slug,
          title = @title,
          summary = @summary,
          body_html = @bodyHtml,
          attachment_media_id = @attachmentMediaId,
          seo_title = @seoTitle,
          seo_description = @seoDescription,
          sort_order = @sortOrder,
          publish_state = @publishState,
          published_at = @publishedAt,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND site_key = @siteKey
    `);
  }
  if (type === 'news') {
    return db.prepare(`
      UPDATE news_articles
      SET slug = @slug,
          title = @title,
          summary = @summary,
          body_html = @bodyHtml,
          hero_media_id = @heroMediaId,
          seo_title = @seoTitle,
          seo_description = @seoDescription,
          sort_order = @sortOrder,
          publish_state = @publishState,
          published_at = @publishedAt,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND site_key = @siteKey
    `);
  }
  return db.prepare(`
    UPDATE case_studies
    SET slug = @slug,
        title = @title,
        summary = @summary,
        body_html = @bodyHtml,
        attachment_media_id = @attachmentMediaId,
        seo_title = @seoTitle,
        seo_description = @seoDescription,
        sort_order = @sortOrder,
        publish_state = @publishState,
        published_at = @publishedAt,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND site_key = @siteKey
  `);
}

function createCatalogRepository(db) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const statements = Object.fromEntries(Object.keys(collections).map((type) => [type, {
    insert: buildInsertStatement(db, type),
    update: buildUpdateStatement(db, type),
    selectById: db.prepare(`SELECT ${collections[type].selectFields.join(', ')} FROM ${collections[type].table} WHERE id = ?`),
    softDelete: db.prepare(`UPDATE ${collections[type].table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND site_key = ?`),
  }]));
  const selectPageById = db.prepare('SELECT id, site_key FROM pages WHERE id = ?');
  const selectMediaById = db.prepare('SELECT id, site_key FROM media_assets WHERE id = ?');

  const mediaFieldLabels = {
    brochureMediaId: '宣传册媒体资源',
    attachmentMediaId: '附件媒体资源',
    heroMediaId: '头图媒体资源',
  };

  function getRecord(type, siteKey, id) {
    assertValidSiteKey(siteKey);
    const row = statements[type].selectById.get(id);
    if (!row || row.site_key !== siteKey) {
      return null;
    }
    return mapRow(row);
  }

  function validatePageParent(siteKey, parentId, recordId = null) {
    if (!parentId) {
      return;
    }

    const parent = selectPageById.get(parentId);
    if (!parent || parent.site_key !== siteKey) {
      throw createAdminValidationError('上级页面必须属于当前站点。', 'same site validation error');
    }
    if (recordId && Number(recordId) === Number(parentId)) {
      throw createAdminValidationError('上级页面不能指向自己。', 'invalid-page-parent-self');
    }
  }

  function validateRequiredFields(type, record) {
    if (type !== 'pages' && !String(record.slug || '').trim()) {
      throw createAdminValidationError('Slug 不能为空，请填写后重试。', `missing-${type}-slug`);
    }

    if (type === 'pages' && !String(record.path || '').trim()) {
      throw createAdminValidationError('页面路径不能为空，请填写后重试。', 'missing-page-path');
    }
  }

  function validateMediaReferences(record) {
    for (const [field, label] of Object.entries(mediaFieldLabels)) {
      const mediaId = record[field];
      if (mediaId === null || mediaId === undefined || mediaId === '') {
        continue;
      }
      const media = selectMediaById.get(mediaId);
      if (!media) {
        throw createAdminValidationError(`${label}不存在，请重新选择。`, `missing-${field}`);
      }
      if (media.site_key !== null && media.site_key !== record.siteKey) {
        throw createAdminValidationError(`${label}必须属于当前站点或全局素材，请重新选择。`, `cross-site-${field}`);
      }
    }
  }

  function translateRecordWriteError(type, error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      if (type === 'pages') {
        return createAdminConflictError('页面路径已存在，请更换后重试。', 'duplicate-page-path');
      }

      return createAdminConflictError('Slug 已存在，请更换后重试。', `duplicate-${type}-slug`);
    }

    return error;
  }

  function createRecord(type, input) {
    assertValidSiteKey(input.siteKey);
    const record = normalizeRecord(type, input);
    validateRequiredFields(type, record);
    if (type === 'pages') {
      validatePageParent(record.siteKey, record.parentId);
    }
    validateMediaReferences(record);
    ensureSite(record.siteKey);
    let info;
    try {
      info = statements[type].insert.run(record);
    } catch (error) {
      throw translateRecordWriteError(type, error);
    }
    return mapRow(statements[type].selectById.get(info.lastInsertRowid));
  }

  function updateRecord(type, siteKey, id, input) {
    const existing = getRecord(type, siteKey, id);
    if (!existing) {
      return null;
    }
    const record = normalizeRecord(type, { ...input, siteKey }, existing);
    validateRequiredFields(type, record);
    if (type === 'pages') {
      validatePageParent(siteKey, record.parentId, id);
    }
    validateMediaReferences(record);
    try {
      statements[type].update.run({ id, ...record });
    } catch (error) {
      throw translateRecordWriteError(type, error);
    }
    return getRecord(type, siteKey, id);
  }

  function listRecords(type, siteKey, options = {}) {
    assertValidSiteKey(siteKey);
    const config = collections[type];
    const clauses = ['site_key = @siteKey'];
    const params = { siteKey };

    if (!options.includeDeleted) {
      clauses.push('deleted_at IS NULL');
    }
    if (options.publishState && options.publishState !== 'all') {
      clauses.push('publish_state = @publishState');
      params.publishState = normalizePublishState(options.publishState);
    }

    const orderBy = config.orderBy[options.sort] || config.orderBy.default;
    const statement = db.prepare(`
      SELECT ${config.selectFields.join(', ')}
      FROM ${config.table}
      WHERE ${clauses.join(' AND ')}
      ORDER BY ${orderBy}
    `);

    const records = statement.all(params).map(mapRow);

    if (options.sort === 'title_desc') {
      records.sort((left, right) => {
        const titleCompare = String(right.title || '').localeCompare(String(left.title || ''), 'zh-CN');
        if (titleCompare !== 0) {
          return titleCompare;
        }
        return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
      });
    }

    return records;
  }

  function softDeleteRecord(type, siteKey, id) {
    assertValidSiteKey(siteKey);
    statements[type].softDelete.run(id, siteKey);
    return getRecord(type, siteKey, id);
  }

  function listPublishedRecords(type, siteKey, options = {}) {
    assertValidSiteKey(siteKey);
    const config = collections[type];
    const clauses = [
      'site_key = @siteKey',
      'deleted_at IS NULL',
      "publish_state = 'published'",
    ];
    const params = { siteKey };

    if (options.slug) {
      clauses.push('slug = @slug');
      params.slug = options.slug;
    }

    if (type === 'pages' && options.path) {
      clauses.push('path = @path');
      params.path = normalizePagePath(options.path);
    }

    const limitClause = Number.isInteger(options.limit) && options.limit > 0
      ? ` LIMIT ${options.limit}`
      : '';
    const statement = db.prepare(`
      SELECT ${config.selectFields.join(', ')}
      FROM ${config.table}
      WHERE ${clauses.join(' AND ')}
      ORDER BY ${config.orderBy.default}${limitClause}
    `);

    return statement.all(params).map(mapRow);
  }

  function findPublishedPageByHierarchicalPath(siteKey, pagePath) {
    assertValidSiteKey(siteKey);
    let currentPath = normalizePagePath(pagePath);

    while (currentPath && currentPath !== '/') {
      const page = listPublishedRecords('pages', siteKey, { path: currentPath, limit: 1 })[0] || null;
      if (page) {
        return page;
      }

      const segments = currentPath.split('/').filter(Boolean);
      segments.pop();
      currentPath = segments.length > 0 ? `/${segments.join('/')}` : '/';
    }

    return listPublishedRecords('pages', siteKey, { path: '/', limit: 1 })[0] || null;
  }

  return {
    deriveSlugFromPath,
    normalizePagePath,
    createRecord,
    getRecord,
    updateRecord,
    listRecords,
    softDeleteRecord,
    createProduct(input) {
      return createRecord('products', input);
    },
    getProduct(siteKey, id) {
      return getRecord('products', siteKey, id);
    },
    updateProduct(siteKey, id, input) {
      return updateRecord('products', siteKey, id, input);
    },
    listProducts(siteKey, options = {}) {
      return listRecords('products', siteKey, options);
    },
    listPublishedProducts(siteKey, options = {}) {
      return listPublishedRecords('products', siteKey, options);
    },
    findPublishedProductBySlug(siteKey, slug) {
      return listPublishedRecords('products', siteKey, { slug, limit: 1 })[0] || null;
    },
    softDeleteProduct(siteKey, id) {
      return softDeleteRecord('products', siteKey, id);
    },
    createSolution(input) {
      return createRecord('solutions', input);
    },
    getSolution(siteKey, id) {
      return getRecord('solutions', siteKey, id);
    },
    updateSolution(siteKey, id, input) {
      return updateRecord('solutions', siteKey, id, input);
    },
    listSolutions(siteKey, options = {}) {
      return listRecords('solutions', siteKey, options);
    },
    listPublishedSolutions(siteKey, options = {}) {
      return listPublishedRecords('solutions', siteKey, options);
    },
    findPublishedSolutionBySlug(siteKey, slug) {
      return listPublishedRecords('solutions', siteKey, { slug, limit: 1 })[0] || null;
    },
    softDeleteSolution(siteKey, id) {
      return softDeleteRecord('solutions', siteKey, id);
    },
    createPage(input) {
      return createRecord('pages', input);
    },
    getPage(siteKey, id) {
      return getRecord('pages', siteKey, id);
    },
    updatePage(siteKey, id, input) {
      return updateRecord('pages', siteKey, id, input);
    },
    listPages(siteKey, options = {}) {
      return listRecords('pages', siteKey, options);
    },
    listPublishedPages(siteKey, options = {}) {
      return listPublishedRecords('pages', siteKey, options);
    },
    findPublishedPageByPath(siteKey, pagePath) {
      return listPublishedRecords('pages', siteKey, { path: pagePath, limit: 1 })[0] || null;
    },
    findPublishedPageByHierarchicalPath,
    softDeletePage(siteKey, id) {
      return softDeleteRecord('pages', siteKey, id);
    },
    createNewsArticle(input) {
      return createRecord('news', input);
    },
    getNewsArticle(siteKey, id) {
      return getRecord('news', siteKey, id);
    },
    updateNewsArticle(siteKey, id, input) {
      return updateRecord('news', siteKey, id, input);
    },
    listNewsArticles(siteKey, options = {}) {
      return listRecords('news', siteKey, options);
    },
    listPublishedNewsArticles(siteKey, options = {}) {
      return listPublishedRecords('news', siteKey, options);
    },
    findPublishedNewsArticleBySlug(siteKey, slug) {
      return listPublishedRecords('news', siteKey, { slug, limit: 1 })[0] || null;
    },
    softDeleteNewsArticle(siteKey, id) {
      return softDeleteRecord('news', siteKey, id);
    },
    createCaseStudy(input) {
      return createRecord('cases', input);
    },
    getCaseStudy(siteKey, id) {
      return getRecord('cases', siteKey, id);
    },
    updateCaseStudy(siteKey, id, input) {
      return updateRecord('cases', siteKey, id, input);
    },
    listCaseStudies(siteKey, options = {}) {
      return listRecords('cases', siteKey, options);
    },
    listPublishedCaseStudies(siteKey, options = {}) {
      return listPublishedRecords('cases', siteKey, options);
    },
    findPublishedCaseStudyBySlug(siteKey, slug) {
      return listPublishedRecords('cases', siteKey, { slug, limit: 1 })[0] || null;
    },
    softDeleteCaseStudy(siteKey, id) {
      return softDeleteRecord('cases', siteKey, id);
    },
  };
}

module.exports = {
  createCatalogRepository,
};
