const fs = require('node:fs');
const express = require('express');

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

  router.get(/^\/(.+)/, (req, res) => {
    const relativePath = normalizeRelativeMediaPath(req.params[0]);
    if (!relativePath) {
      return res.status(404).end();
    }

    const admin = getAuthenticatedAdmin(req);
    const asset = admin
      ? mediaRepository.findManagedAssetByRelativePath(relativePath)
      : mediaRepository.findPublicAssetByPath(resolveSiteForHostname(siteRepository, req.hostname)?.siteKey || null, relativePath);

    if (!asset?.storagePath || !fs.existsSync(asset.storagePath)) {
      return res.status(404).end();
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (asset.mimeType) {
      res.type(asset.mimeType);
    }

    return res.sendFile(asset.storagePath, (error) => {
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
