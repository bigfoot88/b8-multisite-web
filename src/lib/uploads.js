const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

function sanitizeFilename(name) {
  return String(name || 'upload')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'upload';
}

function ensureUploadRoot(uploadRoot) {
  fs.mkdirSync(uploadRoot, { recursive: true });
  return uploadRoot;
}

function createUploader({ uploadRoot }) {
  ensureUploadRoot(uploadRoot);

  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadRoot);
    },
    filename(req, file, cb) {
      const safeName = sanitizeFilename(file.originalname);
      cb(null, `${Date.now()}-${crypto.randomUUID()}-${safeName}`);
    },
  });

  return multer({ storage }).single('file');
}

function toPublicUploadPath(file) {
  return `/uploads/${path.basename(file.path)}`;
}

module.exports = {
  createUploader,
  ensureUploadRoot,
  sanitizeFilename,
  toPublicUploadPath,
};
