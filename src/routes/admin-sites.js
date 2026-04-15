const express = require('express');

const { createAdminValidationError, isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { renderAdmin, requireKnownSite } = require('./admin-shared');

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function buildSiteSettingsInput(siteKey, body = {}) {
  return {
    siteKey,
    brandName: normalizeOptionalText(body.brandName) || siteKey.toUpperCase(),
    domain: (body?.domain?.trim() || `${siteKey}.local`).toLowerCase(),
    seoTitle: normalizeOptionalText(body.seoTitle),
    seoDescription: normalizeOptionalText(body.seoDescription),
    contactEmail: normalizeOptionalText(body.contactEmail),
    contactPhone: normalizeOptionalText(body.contactPhone),
    contactAddress: normalizeOptionalText(body.contactAddress),
    homeBannerMediaId: normalizeOptionalText(body.homeBannerMediaId),
    homeBannerSecondaryMediaId: normalizeOptionalText(body.homeBannerSecondaryMediaId),
    homeFeatureMediaId: normalizeOptionalText(body.homeFeatureMediaId),
  };
}

function assertScalarHomepageMediaId(value, label) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    throw createAdminValidationError(`${label}必须是有效的媒体资源编号，请重新选择。`, 'invalid-site-settings-media-asset');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || /^\d+$/.test(trimmed)) {
      return;
    }
  } else if (Number.isInteger(value)) {
    return;
  }

  throw createAdminValidationError(`${label}必须是有效的媒体资源编号，请重新选择。`, 'invalid-site-settings-media-asset');
}

function decorateSiteSettingsForAdmin(settings, mediaRepository) {
  if (!settings) {
    return settings;
  }

  const ids = [
    settings.homeBannerMediaId,
    settings.homeBannerSecondaryMediaId,
    settings.homeFeatureMediaId,
  ].filter(Boolean);
  const assets = new Map(mediaRepository.findByIds(ids).map((asset) => [asset.id, asset]));

  return {
    ...settings,
    homeBannerAsset: settings.homeBannerMediaId ? assets.get(Number(settings.homeBannerMediaId)) || null : null,
    homeBannerSecondaryAsset: settings.homeBannerSecondaryMediaId ? assets.get(Number(settings.homeBannerSecondaryMediaId)) || null : null,
    homeFeatureAsset: settings.homeFeatureMediaId ? assets.get(Number(settings.homeFeatureMediaId)) || null : null,
  };
}

function renderSiteSettingsPage(req, res, { siteKey, settings, errorMessage = null }) {
  return renderAdmin(req, res, {
    title: '站点设置 · 中文后台',
    pageTitle: '站点设置',
    pageDescription: '维护站点品牌、联系方式与 SEO 字段。',
    bodyView: '../admin/lists/site-settings',
    currentPath: `/admin/${siteKey}/settings`,
    siteKey,
    settings: decorateSiteSettingsForAdmin(settings, req.app.locals.mediaRepository),
    errorMessage,
  });
}

function createAdminSitesRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/:siteKey/settings', requireKnownSite, (req, res) => {
    return renderSiteSettingsPage(req, res, {
      siteKey: req.params.siteKey,
      settings: req.app.locals.siteRepository.getSiteSettings(req.params.siteKey),
    });
  });

  router.post('/:siteKey/settings', requireKnownSite, (req, res, next) => {
    const siteKey = req.params.siteKey;
    const nextSettings = buildSiteSettingsInput(siteKey, req.body);
    const existingSite = req.app.locals.siteRepository.getSiteSettingsByDomain(nextSettings.domain);

    if (existingSite && existingSite.siteKey !== siteKey) {
      res.status(400);
      return renderSiteSettingsPage(req, res, {
        siteKey,
        settings: nextSettings,
        errorMessage: '域名已被其他站点使用，请更换后重试。',
      });
    }

    try {
      assertScalarHomepageMediaId(req.body.homeBannerMediaId, '首页全宽图（第一张）');
      assertScalarHomepageMediaId(req.body.homeBannerSecondaryMediaId, '首页全宽图（第二张）');
      assertScalarHomepageMediaId(req.body.homeFeatureMediaId, '首页解决方案主图');
      req.app.locals.siteRepository.upsertSiteSettings(nextSettings);
    } catch (error) {
      if (isExpectedAdminError(error)) {
        res.status(error.statusCode);
        return renderSiteSettingsPage(req, res, {
          siteKey,
          settings: nextSettings,
          errorMessage: error.message,
        });
      }

      return next(error);
    }

    return res.redirect(`/admin/${siteKey}/settings`);
  });

  return router;
}

module.exports = {
  createAdminSitesRouter,
};
