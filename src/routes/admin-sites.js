const express = require('express');

const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function createAdminSitesRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/:siteKey/settings', requireKnownSite, (req, res) => {
    const settings = req.app.locals.siteRepository.getSiteSettings(req.params.siteKey);

    return renderAdmin(req, res, {
      title: '站点设置 · 中文后台',
      pageTitle: '站点设置',
      pageDescription: '维护站点品牌、联系方式与 SEO 字段。',
      bodyView: '../admin/lists/site-settings',
      currentPath: `/admin/${req.params.siteKey}/settings`,
      siteKey: req.params.siteKey,
      settings,
    });
  });

  router.post('/:siteKey/settings', requireKnownSite, (req, res) => {
    const siteKey = req.params.siteKey;
    const nextDomain = (req.body?.domain?.trim() || `${siteKey}.local`).toLowerCase();
    const existingSite = req.app.locals.siteRepository.getSiteSettingsByDomain(nextDomain);

    if (existingSite && existingSite.siteKey !== siteKey) {
      res.status(400);
      return renderAdmin(req, res, {
        title: '站点设置 · 中文后台',
        pageTitle: '站点设置',
        pageDescription: '维护站点品牌、联系方式与 SEO 字段。',
        bodyView: '../admin/lists/site-settings',
        currentPath: `/admin/${siteKey}/settings`,
        siteKey,
        settings: {
          siteKey,
          brandName: req.body?.brandName?.trim() || siteKey.toUpperCase(),
          domain: nextDomain,
          seoTitle: req.body?.seoTitle?.trim() || null,
          seoDescription: req.body?.seoDescription?.trim() || null,
          contactEmail: req.body?.contactEmail?.trim() || null,
          contactPhone: req.body?.contactPhone?.trim() || null,
          contactAddress: req.body?.contactAddress?.trim() || null,
        },
        errorMessage: '域名已被其他站点使用，请更换后重试。',
      });
    }

    req.app.locals.siteRepository.upsertSiteSettings({
      siteKey,
      brandName: req.body?.brandName?.trim() || siteKey.toUpperCase(),
      domain: nextDomain,
      seoTitle: req.body?.seoTitle?.trim() || null,
      seoDescription: req.body?.seoDescription?.trim() || null,
      contactEmail: req.body?.contactEmail?.trim() || null,
      contactPhone: req.body?.contactPhone?.trim() || null,
      contactAddress: req.body?.contactAddress?.trim() || null,
    });

    return res.redirect(`/admin/${siteKey}/settings`);
  });

  return router;
}

module.exports = {
  createAdminSitesRouter,
};
