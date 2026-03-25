const express = require('express');

const { sites } = require('../config/sites');
const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite, sectionLinks, siteLabels } = require('./admin-shared');

function buildSiteSummary(req, siteKey) {
  const catalogRepository = req.app.locals.catalogRepository;
  const siteRepository = req.app.locals.siteRepository;
  const settings = siteRepository.getSiteSettings(siteKey);

  return {
    siteKey,
    label: siteLabels[siteKey],
    href: `/admin/${siteKey}`,
    brandName: settings?.brandName || siteKey.toUpperCase(),
    counts: {
      sections: siteRepository.listSections(siteKey).length,
      navigation: siteRepository.listNavigation(siteKey).length,
      pages: catalogRepository.listPages(siteKey).length,
      products: catalogRepository.listProducts(siteKey).length,
      solutions: catalogRepository.listSolutions(siteKey).length,
      news: catalogRepository.listNewsArticles(siteKey).length,
      cases: catalogRepository.listCaseStudies(siteKey).length,
    },
    shortcuts: sectionLinks.map((link) => ({
      label: link.label,
      href: link.href(siteKey),
    })),
  };
}

function createAdminDashboardRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/', (req, res) => {
    const siteSummaries = sites.map((siteKey) => buildSiteSummary(req, siteKey));
    const mediaCount = req.app.locals.mediaRepository.listAssets().length;

    return renderAdmin(req, res, {
      title: '中文后台总控台',
      pageTitle: '中文后台总控台',
      pageDescription: '进入各站点管理内容、首页模块、媒体与导航。',
      bodyView: '../admin/dashboard',
      currentPath: '/admin',
      siteSummaries,
      mediaCount,
      currentSection: null,
    });
  });

  router.get('/media', (req, res) => res.redirect('/admin/media'));

  router.get('/:siteKey', requireKnownSite, (req, res) => {
    const siteSummary = buildSiteSummary(req, req.params.siteKey);

    return renderAdmin(req, res, {
      title: `${siteSummary.label} · 中文后台`,
      pageTitle: `${siteSummary.label}`,
      pageDescription: '查看当前站点的内容概览与快捷入口。',
      bodyView: '../admin/dashboard',
      currentPath: `/admin/${req.params.siteKey}`,
      siteKey: req.params.siteKey,
      siteSummary,
      currentSection: req.params.siteKey,
    });
  });

  return router;
}

module.exports = {
  createAdminDashboardRouter,
};
