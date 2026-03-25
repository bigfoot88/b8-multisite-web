const express = require('express');

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

  router.get('/:siteKey/pages', requireKnownSite, (req, res) => {
    const filters = buildFilters(req.query);
    const pages = req.app.locals.catalogRepository.listPages(req.params.siteKey, {
      includeDeleted: filters.status === 'all',
      publishState: filters.publishState,
      sort: filters.sort,
    });
    const editId = req.query.edit ? Number.parseInt(req.query.edit, 10) : null;
    const page = editId ? req.app.locals.catalogRepository.getPage(req.params.siteKey, editId) : null;

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
        seoTitle: '',
        seoDescription: '',
        sortOrder: 100,
        publishState: 'draft',
      },
      filters,
      basePath: `/admin/${req.params.siteKey}/pages`,
      formView: '../admin/forms/page',
      pageOptions: pages.filter((item) => !page || item.id !== page.id),
    });
  });

  router.post('/:siteKey/pages', requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.createPage({
      ...req.body,
      siteKey: req.params.siteKey,
    });

    return res.redirect(`/admin/${req.params.siteKey}/pages`);
  });

  router.post('/:siteKey/pages/:id', requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.updatePage(req.params.siteKey, req.params.id, req.body || {});
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
