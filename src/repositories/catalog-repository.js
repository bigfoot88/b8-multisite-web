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

function deriveSlugFromPath(value) {
  const parts = String(value || '').split('/').filter(Boolean);
  return parts.at(-1) || 'home';
}

function normalizeRecord(type, input, existing = null) {
  const publishState = normalizePublishState(input.publishState, existing?.publishState || 'draft');
  const publishedAt = publishState === 'published'
    ? (input.publishedAt || existing?.publishedAt || new Date().toISOString())
    : null;

  if (type === 'pages') {
    const pathValue = input.path || existing?.path;
    return {
      siteKey: input.siteKey || existing?.siteKey,
      parentId: normalizeInteger(input.parentId, existing?.parentId ?? null),
      path: pathValue,
      slug: input.slug || existing?.slug || deriveSlugFromPath(pathValue),
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
      slug: input.slug || existing?.slug,
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
      slug: input.slug || existing?.slug,
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
    slug: input.slug || existing?.slug,
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
      throw new Error('Page parent must belong to the same site');
    }
    if (recordId && Number(recordId) === Number(parentId)) {
      throw new Error('Page parent must not reference itself');
    }
  }

  function createRecord(type, input) {
    ensureSite(input.siteKey);
    const record = normalizeRecord(type, input);
    if (type === 'pages') {
      validatePageParent(record.siteKey, record.parentId);
    }
    const info = statements[type].insert.run(record);
    return mapRow(statements[type].selectById.get(info.lastInsertRowid));
  }

  function updateRecord(type, siteKey, id, input) {
    const existing = getRecord(type, siteKey, id);
    if (!existing) {
      return null;
    }
    const record = normalizeRecord(type, { ...input, siteKey }, existing);
    if (type === 'pages') {
      validatePageParent(siteKey, record.parentId, id);
    }
    statements[type].update.run({ id, ...record });
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

  return {
    deriveSlugFromPath,
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
    softDeleteCaseStudy(siteKey, id) {
      return softDeleteRecord('cases', siteKey, id);
    },
  };
}

module.exports = {
  createCatalogRepository,
};
