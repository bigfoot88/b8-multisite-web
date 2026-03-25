const express = require('express');

const { isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function buildFilters(query) {
  return {
    publishState: query.publishState || 'all',
    status: query.status || 'active',
    sort: query.sort || 'default',
  };
}

function createAdminPagesRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  function renderPagesPage(req, res, { status = 200, record = null, errorMessage = '' } = {}) {
    const filters = buildFilters(req.query);
    const pages = req.app.locals.catalogRepository.listPages(req.params.siteKey, {
      includeDeleted: filters.status === 'all',
      publishState: filters.publishState,
      sort: filters.sort,
    });
    const editId = record?.id ? Number.parseInt(record.id, 10) : (req.query.edit ? Number.parseInt(req.query.edit, 10) : null);
    const page = record || (editId ? req.app.locals.catalogRepository.getPage(req.params.siteKey, editId) : null);

    res.status(status);
    return renderAdmin(req, res, {
      title: '页面管理 · 中文后台',
      pageTitle: '页面管理',
      pageDescription: '维护层级页面路径、上级页面与发布状态。',
      bodyView: '../admin/lists/pages',
      currentPath: `/admin/${req.params.siteKey}/pages`,
      siteKey: req.params.siteKey,
      records: pages,
      record: page,
      emptyRecord: {
        id: null,
        parentId: null,
        path: '/',
        slug: '',
        title: '',
        summary: '',
        bodyHtml: '',
        attachmentMediaId: '',
        seoTitle: '',
        seoDescription: '',
        sortOrder: 100,
        publishState: 'draft',
      },
      filters,
      basePath: `/admin/${req.params.siteKey}/pages`,
      formView: '../admin/forms/page',
      pageOptions: pages.filter((item) => !page || Number(item.id) !== Number(page.id)),
      errorMessage,
    });
  }

  router.get('/:siteKey/pages', requireKnownSite, (req, res) => {
    return renderPagesPage(req, res);
  });

  router.post('/:siteKey/pages', requireKnownSite, (req, res, next) => {
    try {
      req.app.locals.catalogRepository.createPage({
        ...req.body,
        siteKey: req.params.siteKey,
      });
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderPagesPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          record: {
            id: null,
            parentId: req.body?.parentId || null,
            path: req.body?.path ?? '/',
            slug: req.body?.slug || '',
            title: req.body?.title || '',
            summary: req.body?.summary || '',
            bodyHtml: req.body?.bodyHtml || '',
            attachmentMediaId: req.body?.attachmentMediaId || '',
            seoTitle: req.body?.seoTitle || '',
            seoDescription: req.body?.seoDescription || '',
            sortOrder: req.body?.sortOrder || 100,
            publishState: req.body?.publishState || 'draft',
          },
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${req.params.siteKey}/pages`);
  });

  router.post('/:siteKey/pages/:id', requireKnownSite, (req, res, next) => {
    try {
      req.app.locals.catalogRepository.updatePage(req.params.siteKey, req.params.id, req.body || {});
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderPagesPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          record: {
            id: req.params.id,
            parentId: req.body?.parentId || null,
            path: req.body?.path ?? '/',
            slug: req.body?.slug || '',
            title: req.body?.title || '',
            summary: req.body?.summary || '',
            bodyHtml: req.body?.bodyHtml || '',
            attachmentMediaId: req.body?.attachmentMediaId || '',
            seoTitle: req.body?.seoTitle || '',
            seoDescription: req.body?.seoDescription || '',
            sortOrder: req.body?.sortOrder || 100,
            publishState: req.body?.publishState || 'draft',
          },
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${req.params.siteKey}/pages`);
  });

  router.post('/:siteKey/pages/:id/delete', requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.softDeletePage(req.params.siteKey, req.params.id);
    return res.redirect(`/admin/${req.params.siteKey}/pages`);
  });

  return router;
}

module.exports = {
  createAdminPagesRouter,
};
