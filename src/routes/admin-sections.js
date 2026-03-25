const express = require('express');

const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function parseConfig(configJson) {
  if (!configJson) {
    return {};
  }

  try {
    return JSON.parse(configJson);
  } catch {
    return {};
  }
}

function createAdminSectionsRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/:siteKey/sections', requireKnownSite, (req, res) => {
    const sections = req.app.locals.siteRepository.listSections(req.params.siteKey);
    const editKey = req.query.edit || '';
    const section = editKey ? req.app.locals.siteRepository.getSection(req.params.siteKey, editKey) : null;

    return renderAdmin(req, res, {
      title: '首页模块 · 中文后台',
      pageTitle: '首页模块',
      pageDescription: '管理 Hero、亮点、数据卡片和预览模块的发布状态。',
      bodyView: '../admin/lists/sections',
      currentPath: `/admin/${req.params.siteKey}/sections`,
      siteKey: req.params.siteKey,
      sections,
      section,
      emptySection: {
        sectionKey: '',
        heading: '',
        subheading: '',
        body: '',
        sortOrder: 0,
        isPublished: true,
        config: {},
      },
    });
  });

  router.post('/:siteKey/sections', requireKnownSite, (req, res) => {
    const sectionKey = req.body?.sectionKey?.trim();
    if (!sectionKey) {
      return res.redirect(`/admin/${req.params.siteKey}/sections`);
    }

    req.app.locals.siteRepository.saveSection({
      siteKey: req.params.siteKey,
      sectionKey,
      heading: req.body?.heading?.trim() || null,
      subheading: req.body?.subheading?.trim() || null,
      body: req.body?.body?.trim() || null,
      sortOrder: req.body?.sortOrder,
      isPublished: req.body?.isPublished === '1',
      config: parseConfig(req.body?.configJson),
    });

    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  router.post('/:siteKey/sections/:sectionKey', requireKnownSite, (req, res) => {
    req.app.locals.siteRepository.saveSection({
      siteKey: req.params.siteKey,
      sectionKey: req.params.sectionKey,
      heading: req.body?.heading?.trim() || null,
      subheading: req.body?.subheading?.trim() || null,
      body: req.body?.body?.trim() || null,
      sortOrder: req.body?.sortOrder,
      isPublished: req.body?.isPublished === '1',
      config: parseConfig(req.body?.configJson),
    });

    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  router.post('/:siteKey/sections/:sectionKey/delete', requireKnownSite, (req, res) => {
    req.app.locals.siteRepository.deleteSection(req.params.siteKey, req.params.sectionKey);
    return res.redirect(`/admin/${req.params.siteKey}/sections`);
  });

  return router;
}

module.exports = {
  createAdminSectionsRouter,
};
