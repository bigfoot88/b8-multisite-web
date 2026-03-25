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

function createAdminCatalogRouter({
  collectionKey,
  pathSegment,
  pageTitle,
  pageDescription,
  listView,
  formView,
  emptyRecord,
}) {
  const router = express.Router();

  router.use(requireAdmin);

  router.get(`/:siteKey/${pathSegment}`, requireKnownSite, (req, res) => {
    const filters = buildFilters(req.query);
    const records = req.app.locals.catalogRepository.listRecords(collectionKey, req.params.siteKey, {
      includeDeleted: filters.status === 'all',
      publishState: filters.publishState,
      sort: filters.sort,
    });
    const editId = req.query.edit ? Number.parseInt(req.query.edit, 10) : null;
    const record = editId ? req.app.locals.catalogRepository.getRecord(collectionKey, req.params.siteKey, editId) : null;

    return renderAdmin(req, res, {
      title: `${pageTitle} · 中文后台`,
      pageTitle,
      pageDescription,
      bodyView: listView,
      currentPath: `/admin/${req.params.siteKey}/${pathSegment}`,
      siteKey: req.params.siteKey,
      records,
      record,
      emptyRecord,
      filters,
      basePath: `/admin/${req.params.siteKey}/${pathSegment}`,
      formView,
    });
  });

  router.post(`/:siteKey/${pathSegment}`, requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.createRecord(collectionKey, {
      ...req.body,
      siteKey: req.params.siteKey,
    });

    return res.redirect(`/admin/${req.params.siteKey}/${pathSegment}`);
  });

  router.post(`/:siteKey/${pathSegment}/:id`, requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.updateRecord(collectionKey, req.params.siteKey, req.params.id, req.body || {});
    return res.redirect(`/admin/${req.params.siteKey}/${pathSegment}`);
  });

  router.post(`/:siteKey/${pathSegment}/:id/delete`, requireKnownSite, (req, res) => {
    req.app.locals.catalogRepository.softDeleteRecord(collectionKey, req.params.siteKey, req.params.id);
    return res.redirect(`/admin/${req.params.siteKey}/${pathSegment}`);
  });

  return router;
}

module.exports = {
  createAdminCatalogRouter,
};
