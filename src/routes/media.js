const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const { sites } = require('../config/sites');
const { resolveSiteForHostname } = require('../lib/host-routing');
const { normalizeRelativeMediaPath } = require('../lib/media-paths');
const { readAdminSession } = require('../lib/session');

function createMediaRouter({ adminRepository, mediaRepository, siteRepository }) {
  const router = express.Router();

  function getAuthenticatedAdmin(req) {
    const session = readAdminSession(req);
    if (!session) {
      return null;
    }

    const admin = adminRepository?.findById ? adminRepository.findById(session.id) : null;
    return admin && admin.isActive ? admin : null;
  }

  function resolveReadableStoragePath(req, asset, relativePath) {
    if (!asset) {
      return null;
    }

    if (asset?.storagePath && fs.existsSync(asset.storagePath)) {
      return asset.storagePath;
    }

    const uploadRoot = req.app?.locals?.uploadRoot;
    if (!uploadRoot || !relativePath) {
      return null;
    }

    const fallbackPath = path.join(uploadRoot, ...relativePath.split('/'));
    if (fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }

    return null;
  }

  function resolveSiteKeyFromPrefixedPath(pathname = '') {
    const normalizedPath = String(pathname || '');
    for (const siteKey of sites) {
      if (normalizedPath === `/${siteKey}` || normalizedPath.startsWith(`/${siteKey}/`)) {
        return siteKey;
      }
    }

    return null;
  }

  function resolvePublicSiteKey(req) {
    const hostSiteKey = resolveSiteForHostname(siteRepository, req.hostname)?.siteKey || null;
    if (hostSiteKey) {
      return hostSiteKey;
    }

    const referer = req.get('referer');
    if (!referer) {
      return null;
    }

    try {
      const refererUrl = new URL(referer);
      return resolveSiteKeyFromPrefixedPath(refererUrl.pathname);
    } catch {
      return null;
    }
  }

  router.get(/^\/(.+)/, (req, res) => {
    const relativePath = normalizeRelativeMediaPath(req.params[0]);
    if (!relativePath) {
      return res.status(404).end();
    }

    const admin = getAuthenticatedAdmin(req);
    const asset = admin
      ? mediaRepository.findManagedAssetByRelativePath(relativePath)
      : mediaRepository.findPublicAssetByPath(resolvePublicSiteKey(req), relativePath);

    const storagePath = resolveReadableStoragePath(req, asset, relativePath);
    if (!storagePath) {
      return res.status(404).end();
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (asset.mimeType) {
      res.type(asset.mimeType);
    }

    return res.sendFile(path.basename(storagePath), {
      root: path.dirname(storagePath),
      dotfiles: 'allow',
    }, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).end();
      }
    });
  });

  return router;
}

module.exports = {
  createMediaRouter,
};
