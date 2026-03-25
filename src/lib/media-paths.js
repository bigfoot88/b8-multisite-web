const path = require('node:path');

function normalizeRelativeMediaPath(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return null;
  }

  const segments = trimmed
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) {
    return null;
  }

  return segments.join('/');
}

function buildPublicMediaPath(relativePath) {
  const normalized = normalizeRelativeMediaPath(relativePath);
  if (!normalized) {
    return null;
  }

  return `/media/${normalized.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function relativePathFromSourceUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('/')) {
    return null;
  }

  if (sourceUrl.startsWith('/media/')) {
    return normalizeRelativeMediaPath(sourceUrl.slice('/media/'.length));
  }

  if (sourceUrl.startsWith('/uploads/')) {
    return normalizeRelativeMediaPath(sourceUrl.slice('/uploads/'.length));
  }

  return null;
}

function relativePathFromStoragePath(storagePath, uploadRoot = null) {
  if (typeof storagePath !== 'string' || !storagePath) {
    return null;
  }

  if (uploadRoot) {
    const relative = path.relative(uploadRoot, storagePath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return normalizeRelativeMediaPath(relative.split(path.sep).join('/'));
    }
  }

  const uploadsMatch = storagePath.match(/[\\/]+uploads[\\/]+(.+)$/);
  if (uploadsMatch?.[1]) {
    return normalizeRelativeMediaPath(uploadsMatch[1].split(path.sep).join('/'));
  }

  return normalizeRelativeMediaPath(path.basename(storagePath));
}

function resolveManagedMediaRelativePath({ sourceUrl = null, storagePath = null, uploadRoot = null } = {}) {
  return relativePathFromSourceUrl(sourceUrl) || relativePathFromStoragePath(storagePath, uploadRoot);
}

module.exports = {
  buildPublicMediaPath,
  normalizeRelativeMediaPath,
  relativePathFromSourceUrl,
  relativePathFromStoragePath,
  resolveManagedMediaRelativePath,
};
