const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const { createAdminValidationError } = require('./admin-errors');

const safeUploadExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
]);

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

function isAllowedUploadFilename(name) {
  return safeUploadExtensions.has(path.extname(String(name || '')).toLowerCase());
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

  return multer({
    storage,
    fileFilter(req, file, cb) {
      if (!isAllowedUploadFilename(file.originalname)) {
        return cb(createAdminValidationError('不支持上传的文件类型，请上传图片或文档。', 'unsafe-upload-type'));
      }

      return cb(null, true);
    },
  }).single('file');
}

function toPublicUploadPath(file) {
  return `/uploads/${path.basename(file.path)}`;
}

function removeUploadedFile(fileOrPath) {
  const filePath = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath?.path;
  if (!filePath) {
    return;
  }

  fs.rmSync(filePath, { force: true });
}

module.exports = {
  createUploader,
  ensureUploadRoot,
  isAllowedUploadFilename,
  removeUploadedFile,
  sanitizeFilename,
  toPublicUploadPath,
};
