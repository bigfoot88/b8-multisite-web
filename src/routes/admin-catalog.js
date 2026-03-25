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

  function renderCatalogPage(req, res, { status = 200, record = null, errorMessage = '' } = {}) {
    const filters = buildFilters(req.query);
    const records = req.app.locals.catalogRepository.listRecords(collectionKey, req.params.siteKey, {
      includeDeleted: filters.status === 'all',
      publishState: filters.publishState,
      sort: filters.sort,
    });
    const editId = record?.id ? Number.parseInt(record.id, 10) : (req.query.edit ? Number.parseInt(req.query.edit, 10) : null);
    const currentRecord = record || (editId ? req.app.locals.catalogRepository.getRecord(collectionKey, req.params.siteKey, editId) : null);

    res.status(status);
    return renderAdmin(req, res, {
      title: `${pageTitle} · 中文后台`,
      pageTitle,
      pageDescription,
      bodyView: listView,
      currentPath: `/admin/${req.params.siteKey}/${pathSegment}`,
      siteKey: req.params.siteKey,
      records,
      record: currentRecord,
      emptyRecord,
      filters,
      basePath: `/admin/${req.params.siteKey}/${pathSegment}`,
      formView,
      errorMessage,
    });
  }

  router.get(`/:siteKey/${pathSegment}`, requireKnownSite, (req, res) => {
    return renderCatalogPage(req, res);
  });

  router.post(`/:siteKey/${pathSegment}`, requireKnownSite, (req, res, next) => {
    try {
      req.app.locals.catalogRepository.createRecord(collectionKey, {
        ...req.body,
        siteKey: req.params.siteKey,
      });
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderCatalogPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          record: {
            ...emptyRecord,
            ...req.body,
          },
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${req.params.siteKey}/${pathSegment}`);
  });

  router.post(`/:siteKey/${pathSegment}/:id`, requireKnownSite, (req, res, next) => {
    try {
      req.app.locals.catalogRepository.updateRecord(collectionKey, req.params.siteKey, req.params.id, req.body || {});
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderCatalogPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          record: {
            ...emptyRecord,
            ...req.body,
            id: req.params.id,
          },
        });
      }

      return next(error);
    }

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
