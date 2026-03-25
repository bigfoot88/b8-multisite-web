const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');

const { requireAdmin } = require('../lib/session');
const { sites } = require('../config/sites');
const { createUploader, toPublicUploadPath } = require('../lib/uploads');
const { renderAdmin } = require('./admin-shared');

function createAdminMediaRouter({ uploadRoot }) {
  const router = express.Router();
  const upload = createUploader({ uploadRoot });

  router.use(requireAdmin);

  router.get('/media', (req, res) => {
    const requestedSiteKey = req.query.siteKey || null;
    const siteKey = requestedSiteKey && sites.includes(requestedSiteKey) ? requestedSiteKey : null;
    const assets = req.app.locals.mediaRepository.listAssets({ siteKey });
    const editKey = req.query.edit || null;
    const asset = editKey ? req.app.locals.mediaRepository.findByAssetKey(editKey) : null;

    return renderAdmin(req, res, {
      title: '媒体库 · 中文后台',
      pageTitle: '媒体库',
      pageDescription: '统一上传站点图片与附件，并支持原位替换与站点重绑。',
      bodyView: '../admin/lists/media',
      currentPath: '/admin/media',
      assets,
      asset,
      selectedSiteKey: siteKey || '',
      availableSites: req.app.locals.siteRepository.listSiteSettings(),
    });
  });

  router.post('/media/:assetKey/rebind', (req, res) => {
    const current = req.app.locals.mediaRepository.findByAssetKey(req.params.assetKey);
    if (!current) {
      return res.redirect('/admin/media');
    }

    const requestedSiteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.trim() : undefined;
    const requestedAltText = typeof req.body?.altText === 'string' ? req.body.altText.trim() : undefined;

    req.app.locals.mediaRepository.updateAsset(req.params.assetKey, {
      siteKey: requestedSiteKey === undefined ? current.siteKey : (requestedSiteKey || null),
      sourceUrl: current.sourceUrl,
      filename: current.filename,
      mimeType: current.mimeType,
      storagePath: current.storagePath,
      altText: requestedAltText === undefined ? current.altText : (requestedAltText || null),
      metadata: current.metadata,
    });

    return res.redirect('/admin/media');
  });

  router.post('/media', upload, (req, res) => {
    if (!req.file) {
      return res.redirect('/admin/media');
    }

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

    return res.redirect('/admin/media');
  });

  router.post('/media/:assetKey/replace', upload, (req, res) => {
    const current = req.app.locals.mediaRepository.findByAssetKey(req.params.assetKey);
    if (!current) {
      return res.redirect('/admin/media');
    }

    const nextFile = req.file;
    const requestedSiteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.trim() : undefined;
    const updated = req.app.locals.mediaRepository.updateAsset(req.params.assetKey, {
      siteKey: requestedSiteKey === undefined ? current.siteKey : (requestedSiteKey || null),
      sourceUrl: nextFile ? toPublicUploadPath(nextFile) : current.sourceUrl,
      filename: nextFile ? nextFile.originalname : current.filename,
      mimeType: nextFile ? nextFile.mimetype : current.mimeType,
      storagePath: nextFile ? nextFile.path : current.storagePath,
      altText: req.body?.altText?.trim() || current.altText,
      metadata: nextFile ? { size: nextFile.size } : current.metadata,
    });

    if (nextFile && current.storagePath && current.storagePath !== updated.storagePath) {
      fs.rmSync(current.storagePath, { force: true });
    }

    return res.redirect('/admin/media');
  });

  return router;
}

module.exports = {
  createAdminMediaRouter,
};
