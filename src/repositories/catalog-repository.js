const { createSiteBootstrap } = require('../lib/site-bootstrap');

function mapRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyHtml: row.body_html,
    heroMediaId: row.hero_media_id ?? null,
    brochureMediaId: row.brochure_media_id,
    attachmentMediaId: row.attachment_media_id,
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

function mapPage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    siteKey: row.site_key,
    parentId: row.parent_id,
    path: row.path,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyHtml: row.body_html,
    attachmentMediaId: row.attachment_media_id,
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

function deriveSlugFromPath(value) {
  const parts = String(value || '').split('/').filter(Boolean);
  return parts.at(-1) || 'home';
}

function createCatalogRepository(db) {
  const { ensureSite, assertValidSiteKey } = createSiteBootstrap(db);
  const insertProduct = db.prepare(`
    INSERT INTO products (site_key, slug, title, summary, body_html, brochure_media_id, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @brochureMediaId, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
  const listProducts = db.prepare('SELECT * FROM products WHERE site_key = ? AND deleted_at IS NULL ORDER BY sort_order ASC, slug ASC');
  const insertSolution = db.prepare(`
    INSERT INTO solutions (site_key, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
  const listSolutions = db.prepare('SELECT * FROM solutions WHERE site_key = ? AND deleted_at IS NULL ORDER BY sort_order ASC, slug ASC');
  const insertPage = db.prepare(`
    INSERT INTO pages (site_key, parent_id, path, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @parentId, @path, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
  const listPages = db.prepare('SELECT * FROM pages WHERE site_key = ? AND deleted_at IS NULL ORDER BY sort_order ASC, path ASC');
  const insertNews = db.prepare(`
    INSERT INTO news_articles (site_key, slug, title, summary, body_html, hero_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @heroMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
  const listNews = db.prepare('SELECT * FROM news_articles WHERE site_key = ? AND deleted_at IS NULL ORDER BY sort_order ASC, published_at IS NULL, published_at DESC, slug ASC');
  const insertCaseStudy = db.prepare(`
    INSERT INTO case_studies (site_key, slug, title, summary, body_html, attachment_media_id, seo_title, seo_description, sort_order, publish_state, published_at, deleted_at)
    VALUES (@siteKey, @slug, @title, @summary, @bodyHtml, @attachmentMediaId, @seoTitle, @seoDescription, @sortOrder, @publishState, @publishedAt, @deletedAt)
  `);
  const listCaseStudies = db.prepare('SELECT * FROM case_studies WHERE site_key = ? AND deleted_at IS NULL ORDER BY sort_order ASC, slug ASC');
  const selectPageById = db.prepare('SELECT id, site_key FROM pages WHERE id = ?');

  return {
    createProduct(input) {
      ensureSite(input.siteKey);
      const payload = {
        siteKey: input.siteKey,
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        bodyHtml: input.bodyHtml ?? null,
        brochureMediaId: input.brochureMediaId ?? null,
        attachmentMediaId: input.attachmentMediaId ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sortOrder: input.sortOrder ?? 100,
        publishState: input.publishState ?? 'draft',
        publishedAt: input.publishedAt ?? null,
        deletedAt: input.deletedAt ?? null,
      };
      const info = insertProduct.run(payload);
      return mapRecord(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
    },
    listProducts(siteKey) {
      assertValidSiteKey(siteKey);
      return listProducts.all(siteKey).map(mapRecord);
    },
    createSolution(input) {
      ensureSite(input.siteKey);
      const payload = {
        siteKey: input.siteKey,
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        bodyHtml: input.bodyHtml ?? null,
        attachmentMediaId: input.attachmentMediaId ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sortOrder: input.sortOrder ?? 100,
        publishState: input.publishState ?? 'draft',
        publishedAt: input.publishedAt ?? null,
        deletedAt: input.deletedAt ?? null,
      };
      const info = insertSolution.run(payload);
      return mapRecord(db.prepare('SELECT * FROM solutions WHERE id = ?').get(info.lastInsertRowid));
    },
    listSolutions(siteKey) {
      assertValidSiteKey(siteKey);
      return listSolutions.all(siteKey).map(mapRecord);
    },
    createPage(input) {
      ensureSite(input.siteKey);
      if (input.parentId !== undefined && input.parentId !== null) {
        const parent = selectPageById.get(input.parentId);

        if (!parent || parent.site_key !== input.siteKey) {
          throw new Error('Page parent must belong to the same site');
        }
      }

      const payload = {
        siteKey: input.siteKey,
        parentId: input.parentId ?? null,
        path: input.path,
        slug: input.slug ?? deriveSlugFromPath(input.path),
        title: input.title,
        summary: input.summary ?? null,
        bodyHtml: input.bodyHtml ?? null,
        attachmentMediaId: input.attachmentMediaId ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sortOrder: input.sortOrder ?? 100,
        publishState: input.publishState ?? 'draft',
        publishedAt: input.publishedAt ?? null,
        deletedAt: input.deletedAt ?? null,
      };
      const info = insertPage.run(payload);
      return mapPage(db.prepare('SELECT * FROM pages WHERE id = ?').get(info.lastInsertRowid));
    },
    listPages(siteKey) {
      assertValidSiteKey(siteKey);
      return listPages.all(siteKey).map(mapPage);
    },
    createNewsArticle(input) {
      ensureSite(input.siteKey);
      const payload = {
        siteKey: input.siteKey,
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        bodyHtml: input.bodyHtml ?? null,
        heroMediaId: input.heroMediaId ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sortOrder: input.sortOrder ?? 100,
        publishState: input.publishState ?? 'draft',
        publishedAt: input.publishedAt ?? null,
        deletedAt: input.deletedAt ?? null,
      };
      const info = insertNews.run(payload);
      return mapRecord(db.prepare('SELECT * FROM news_articles WHERE id = ?').get(info.lastInsertRowid));
    },
    listNewsArticles(siteKey) {
      assertValidSiteKey(siteKey);
      return listNews.all(siteKey).map(mapRecord);
    },
    createCaseStudy(input) {
      ensureSite(input.siteKey);
      const payload = {
        siteKey: input.siteKey,
        slug: input.slug,
        title: input.title,
        summary: input.summary ?? null,
        bodyHtml: input.bodyHtml ?? null,
        attachmentMediaId: input.attachmentMediaId ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sortOrder: input.sortOrder ?? 100,
        publishState: input.publishState ?? 'draft',
        publishedAt: input.publishedAt ?? null,
        deletedAt: input.deletedAt ?? null,
      };
      const info = insertCaseStudy.run(payload);
      return mapRecord(db.prepare('SELECT * FROM case_studies WHERE id = ?').get(info.lastInsertRowid));
    },
    listCaseStudies(siteKey) {
      assertValidSiteKey(siteKey);
      return listCaseStudies.all(siteKey).map(mapRecord);
    },
  };
}

module.exports = {
  createCatalogRepository,
};
