const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');

const { createAdminNotFoundError, isExpectedAdminError } = require('../lib/admin-errors');
const { requireAdmin } = require('../lib/session');
const { sites } = require('../config/sites');
const { createUploader, removeUploadedFile, toInlineUploadPath, toPublicUploadPath } = require('../lib/uploads');
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

  router.get('/media/list-json', (req, res) => {
    const requestedSiteKey = req.query.siteKey || null;
    const siteKey = requestedSiteKey && sites.includes(requestedSiteKey) ? requestedSiteKey : null;
    const assets = req.app.locals.mediaRepository.listAssets({ siteKey });
    const imageAssets = assets.filter((a) => a.mimeType && a.mimeType.startsWith('image/'));
    return res.json({
      assets: imageAssets.map((a) => ({
        id: a.id,
        publicUrl: a.publicUrl || a.sourceUrl,
        filename: a.filename,
        altText: a.altText,
      })),
    });
  });

  function handleUpload(req, res, next, options, onSuccess) {
    upload(req, res, (error) => {
      if (error) {
        removeUploadedFile(req.file);
        if (isExpectedAdminError(error)) {
          return renderMediaPage(req, res, {
            status: error.statusCode,
            errorMessage: error.message,
            asset: options?.asset,
          });
        }

        return next(error);
      }

      return onSuccess();
    });
  }

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

  router.post('/media', (req, res, next) => {
    return handleUpload(req, res, next, {}, () => {
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
  });

  router.post('/media/inline-upload', (req, res, next) => {
    upload(req, res, (error) => {
      if (error) {
        removeUploadedFile(req.file);
        if (isExpectedAdminError(error)) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return next(error);
      }

      if (!req.file) {
        return res.status(400).json({ error: '请先选择要上传的图片。' });
      }

      try {
        const asset = req.app.locals.mediaRepository.createAsset({
          assetKey: crypto.randomUUID(),
          siteKey: req.body?.siteKey?.trim() || null,
          sourceUrl: toInlineUploadPath(req.file),
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          storagePath: req.file.path,
          altText: req.body?.altText?.trim() || null,
          metadata: {
            size: req.file.size,
          },
        });

        return res.status(201).json({
          assetKey: asset.assetKey,
          url: asset.sourceUrl,
          filename: asset.filename,
          altText: asset.altText,
        });
      } catch (error) {
        removeUploadedFile(req.file);
        if (isExpectedAdminError(error)) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return next(error);
      }
    });
  });

  router.post('/media/:assetKey/replace', (req, res, next) => {
    const current = req.app.locals.mediaRepository.findByAssetKey(req.params.assetKey);
    if (!current) {
      return renderMediaPage(req, res, {
        status: 404,
        errorMessage: createAdminNotFoundError('未找到要替换的素材。').message,
      });
    }

    return handleUpload(req, res, next, { asset: current }, () => {
      const nextFile = req.file;
      const requestedSiteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.trim() : undefined;
      const requestedAltText = typeof req.body?.altText === 'string' ? req.body.altText.trim() : undefined;
      let updated;
      try {
        updated = req.app.locals.mediaRepository.updateAsset(req.params.assetKey, {
          siteKey: requestedSiteKey === undefined ? current.siteKey : (requestedSiteKey || null),
          sourceUrl: nextFile ? toPublicUploadPath(nextFile) : current.sourceUrl,
          filename: nextFile ? nextFile.originalname : current.filename,
          mimeType: nextFile ? nextFile.mimetype : current.mimeType,
          storagePath: nextFile ? nextFile.path : current.storagePath,
          altText: requestedAltText === undefined ? current.altText : (requestedAltText || null),
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
              altText: requestedAltText === undefined ? current.altText : (requestedAltText || null),
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
  });

  return router;
}

module.exports = {
  createAdminMediaRouter,
};
