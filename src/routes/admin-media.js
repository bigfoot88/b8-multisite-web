const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');

const { createAdminNotFoundError, isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { sites } = require('../config/sites');
const { createUploader, removeUploadedFile, toPublicUploadPath } = require('../lib/uploads');
const { renderAdmin } = require('./admin-shared');

function createAdminMediaRouter({ uploadRoot }) {
  const router = express.Router();
  const upload = createUploader({ uploadRoot });

  router.use(requireAdmin);

  function renderMediaPage(req, res, { status = 200, asset = undefined, errorMessage = '' } = {}) {
    const requestedSiteKey = req.query.siteKey || null;
    const siteKey = requestedSiteKey && sites.includes(requestedSiteKey) ? requestedSiteKey : null;
    const assets = req.app.locals.mediaRepository.listAssets({ siteKey });
    const editKey = req.query.edit || null;
    const selectedAsset = asset === undefined ? (editKey ? req.app.locals.mediaRepository.findByAssetKey(editKey) : null) : asset;

    res.status(status);
    return renderAdmin(req, res, {
      title: '媒体库 · 中文后台',
      pageTitle: '媒体库',
      pageDescription: '统一上传站点图片与附件，并支持原位替换与站点重绑。',
      bodyView: '../admin/lists/media',
      currentPath: '/admin/media',
      assets,
      asset: selectedAsset,
      selectedSiteKey: siteKey || '',
      availableSites: req.app.locals.siteRepository.listSiteSettings(),
      errorMessage,
    });
  }

  router.get('/media', (req, res) => {
    return renderMediaPage(req, res);
  });

  router.post('/media/:assetKey/rebind', (req, res, next) => {
    const current = req.app.locals.mediaRepository.findByAssetKey(req.params.assetKey);
    if (!current) {
      return renderMediaPage(req, res, {
        status: 404,
        errorMessage: createAdminNotFoundError('未找到要重绑的素材。').message,
      });
    }

    const requestedSiteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.trim() : undefined;
    const requestedAltText = typeof req.body?.altText === 'string' ? req.body.altText.trim() : undefined;

    try {
      req.app.locals.mediaRepository.updateAsset(req.params.assetKey, {
        siteKey: requestedSiteKey === undefined ? current.siteKey : (requestedSiteKey || null),
        sourceUrl: current.sourceUrl,
        filename: current.filename,
        mimeType: current.mimeType,
        storagePath: current.storagePath,
        altText: requestedAltText === undefined ? current.altText : (requestedAltText || null),
        metadata: current.metadata,
      });
    } catch (error) {
      if (isExpectedAdminError(error)) {
        return renderMediaPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          asset: {
            ...current,
            altText: requestedAltText === undefined ? current.altText : (requestedAltText || null),
          },
        });
      }

      return next(error);
    }

    return res.redirect('/admin/media');
  });

  router.post('/media', upload, (req, res, next) => {
    if (!req.file) {
      return res.redirect('/admin/media');
    }

    try {
      req.app.locals.mediaRepository.createAsset({
        assetKey: crypto.randomUUID(),
        siteKey: req.body?.siteKey?.trim() || null,
        sourceUrl: toPublicUploadPath(req.file),
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        altText: req.body?.altText?.trim() || null,
        metadata: {
          size: req.file.size,
        },
      });
    } catch (error) {
      removeUploadedFile(req.file);
      if (isExpectedAdminError(error)) {
        return renderMediaPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
        });
      }

      return next(error);
    }

    return res.redirect('/admin/media');
  });

  router.post('/media/:assetKey/replace', upload, (req, res, next) => {
    const current = req.app.locals.mediaRepository.findByAssetKey(req.params.assetKey);
    if (!current) {
      removeUploadedFile(req.file);
      return renderMediaPage(req, res, {
        status: 404,
        errorMessage: createAdminNotFoundError('未找到要替换的素材。').message,
      });
    }

    const nextFile = req.file;
    const requestedSiteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.trim() : undefined;
    let updated;
    try {
      updated = req.app.locals.mediaRepository.updateAsset(req.params.assetKey, {
        siteKey: requestedSiteKey === undefined ? current.siteKey : (requestedSiteKey || null),
        sourceUrl: nextFile ? toPublicUploadPath(nextFile) : current.sourceUrl,
        filename: nextFile ? nextFile.originalname : current.filename,
        mimeType: nextFile ? nextFile.mimetype : current.mimeType,
        storagePath: nextFile ? nextFile.path : current.storagePath,
        altText: req.body?.altText?.trim() || current.altText,
        metadata: nextFile ? { size: nextFile.size } : current.metadata,
      });
    } catch (error) {
      removeUploadedFile(nextFile);
      if (isExpectedAdminError(error)) {
        return renderMediaPage(req, res, {
          status: error.statusCode,
          errorMessage: error.message,
          asset: {
            ...current,
            altText: req.body?.altText?.trim() || current.altText,
          },
        });
      }

      return next(error);
    }

    if (nextFile && current.storagePath && updated && current.storagePath !== updated.storagePath) {
      fs.rmSync(current.storagePath, { force: true });
    }

    return res.redirect('/admin/media');
  });

  return router;
}

module.exports = {
  createAdminMediaRouter,
};
