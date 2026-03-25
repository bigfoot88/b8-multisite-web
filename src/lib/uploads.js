const crypto = require('node:crypto');
const { isUtf8 } = require('node:buffer');
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

const supportedUploadTypes = [
  {
    key: 'png',
    mimeType: 'image/png',
    extensions: new Set(['.png']),
  },
  {
    key: 'jpeg',
    mimeType: 'image/jpeg',
    extensions: new Set(['.jpg', '.jpeg']),
  },
  {
    key: 'gif',
    mimeType: 'image/gif',
    extensions: new Set(['.gif']),
  },
  {
    key: 'webp',
    mimeType: 'image/webp',
    extensions: new Set(['.webp']),
  },
  {
    key: 'avif',
    mimeType: 'image/avif',
    extensions: new Set(['.avif']),
  },
  {
    key: 'pdf',
    mimeType: 'application/pdf',
    extensions: new Set(['.pdf']),
  },
  {
    key: 'txt',
    mimeType: 'text/plain; charset=utf-8',
    extensions: new Set(['.txt']),
  },
  {
    key: 'csv',
    mimeType: 'text/csv; charset=utf-8',
    extensions: new Set(['.csv']),
  },
  {
    key: 'ole',
    mimeType: 'application/msword',
    extensions: new Set(['.doc', '.xls', '.ppt']),
  },
  {
    key: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: new Set(['.docx']),
  },
  {
    key: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: new Set(['.xlsx']),
  },
  {
    key: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: new Set(['.pptx']),
  },
  {
    key: 'zip',
    mimeType: 'application/zip',
    extensions: new Set(['.zip']),
  },
];

const uploadTypeByKey = new Map(supportedUploadTypes.map((type) => [type.key, type]));
const textUploadTypeKeys = new Set(['txt', 'csv']);

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

function bufferStartsWith(buffer, signature) {
  return signature.every((value, index) => buffer[index] === value);
}

function isContinuationByte(byte) {
  return (byte & 0b11000000) === 0b10000000;
}

function getExpectedUtf8Length(byte) {
  if (byte >= 0xc2 && byte <= 0xdf) {
    return 2;
  }
  if (byte >= 0xe0 && byte <= 0xef) {
    return 3;
  }
  if (byte >= 0xf0 && byte <= 0xf4) {
    return 4;
  }
  return 0;
}

function getIncompleteUtf8SequenceInfo(buffer, sequenceStart) {
  const leadByte = buffer[sequenceStart];
  const expectedLength = getExpectedUtf8Length(leadByte);
  const actualLength = buffer.length - sequenceStart;

  if (!expectedLength || actualLength >= expectedLength) {
    return null;
  }

  for (let index = sequenceStart + 1; index < buffer.length; index += 1) {
    if (!isContinuationByte(buffer[index])) {
      return null;
    }
  }

  const firstContinuation = buffer[sequenceStart + 1];
  if (firstContinuation === undefined) {
    return { sequenceStart, expectedLength, actualLength };
  }

  if (leadByte === 0xe0) {
    return firstContinuation >= 0xa0 && firstContinuation <= 0xbf
      ? { sequenceStart, expectedLength, actualLength }
      : null;
  }
  if (leadByte === 0xed) {
    return firstContinuation >= 0x80 && firstContinuation <= 0x9f
      ? { sequenceStart, expectedLength, actualLength }
      : null;
  }
  if (leadByte === 0xf0) {
    return firstContinuation >= 0x90 && firstContinuation <= 0xbf
      ? { sequenceStart, expectedLength, actualLength }
      : null;
  }
  if (leadByte === 0xf4) {
    return firstContinuation >= 0x80 && firstContinuation <= 0x8f
      ? { sequenceStart, expectedLength, actualLength }
      : null;
  }

  return { sequenceStart, expectedLength, actualLength };
}

function getUtf8Sample(handle, buffer, bytesRead, fileSize) {
  if (isUtf8(buffer)) {
    return buffer;
  }

  if (fileSize <= bytesRead) {
    return null;
  }

  let sequenceStart = buffer.length - 1;
  while (sequenceStart >= 0 && isContinuationByte(buffer[sequenceStart])) {
    sequenceStart -= 1;
  }

  if (sequenceStart < 0) {
    return null;
  }

  const info = getIncompleteUtf8SequenceInfo(buffer, sequenceStart);
  if (!info) {
    return null;
  }

  const remainingBytes = fileSize - bytesRead;
  const neededBytes = info.expectedLength - info.actualLength;
  if (remainingBytes < neededBytes) {
    return null;
  }

  const completion = Buffer.alloc(neededBytes);
  const completionBytesRead = fs.readSync(handle, completion, 0, neededBytes, bytesRead);
  if (completionBytesRead !== neededBytes) {
    return null;
  }

  const completedBuffer = Buffer.concat([buffer, completion]);
  return isUtf8(completedBuffer) ? completedBuffer : null;
}

function isProbablyText(buffer) {
  if (!buffer.length) {
    return true;
  }

  if (!isUtf8(buffer)) {
    return false;
  }

  let printableChars = 0;
  let totalChars = 0;
  for (const char of buffer.toString('utf8')) {
    totalChars += 1;
    if (char === '\0') {
      return false;
    }
    if (char === '\t' || char === '\n' || char === '\r' || char === '\ufeff' || !/\p{C}/u.test(char)) {
      printableChars += 1;
    }
  }

  return printableChars / totalChars > 0.9;
}

function detectZipContainerType(buffer) {
  const value = buffer.toString('latin1');
  if (value.includes('[Content_Types].xml') && value.includes('word/')) {
    return 'docx';
  }
  if (value.includes('[Content_Types].xml') && value.includes('xl/')) {
    return 'xlsx';
  }
  if (value.includes('[Content_Types].xml') && value.includes('ppt/')) {
    return 'pptx';
  }
  return 'zip';
}

function detectTextType(buffer) {
  if (!isProbablyText(buffer)) {
    return null;
  }

  const snippet = buffer.toString('utf8').trimStart().slice(0, 512).toLowerCase();
  let activeContentPrefix = snippet;
  let nextPrefix = activeContentPrefix.replace(/^(?:(?:<\?xml\b[\s\S]*?\?>)|(?:<!--[\s\S]*?-->)|(?:<!doctype[^>]*>))\s*/i, '');
  while (nextPrefix !== activeContentPrefix) {
    activeContentPrefix = nextPrefix;
    nextPrefix = activeContentPrefix.replace(/^(?:(?:<\?xml\b[\s\S]*?\?>)|(?:<!--[\s\S]*?-->)|(?:<!doctype[^>]*>))\s*/i, '');
  }
  if (/^<!doctype html\b/.test(snippet) || /^<html\b|^<script\b|^<svg\b|^<iframe\b|^<object\b|^<embed\b/.test(activeContentPrefix)) {
    return 'html';
  }
  if (snippet.includes(',') && snippet.includes('\n')) {
    return 'csv';
  }
  return 'txt';
}

function detectUploadType(filePath) {
  const handle = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(65536);
    const bytesRead = fs.readSync(handle, buffer, 0, buffer.length, 0);
    const chunk = buffer.subarray(0, bytesRead);
    const fileSize = fs.fstatSync(handle).size;

    if (bufferStartsWith(chunk, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
      return 'png';
    }
    if (bufferStartsWith(chunk, [0xff, 0xd8, 0xff])) {
      return 'jpeg';
    }
    if (chunk.subarray(0, 6).toString('ascii') === 'GIF87a' || chunk.subarray(0, 6).toString('ascii') === 'GIF89a') {
      return 'gif';
    }
    if (chunk.subarray(0, 4).toString('ascii') === 'RIFF' && chunk.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'webp';
    }
    if (chunk.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(chunk.subarray(8, 16).toString('ascii'))) {
      return 'avif';
    }
    if (chunk.subarray(0, 5).toString('ascii') === '%PDF-') {
      return 'pdf';
    }
    if (bufferStartsWith(chunk, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      return 'ole';
    }
    if (
      bufferStartsWith(chunk, [0x50, 0x4b, 0x03, 0x04])
      || bufferStartsWith(chunk, [0x50, 0x4b, 0x05, 0x06])
      || bufferStartsWith(chunk, [0x50, 0x4b, 0x07, 0x08])
    ) {
      return detectZipContainerType(chunk);
    }

    const textSample = getUtf8Sample(handle, chunk, bytesRead, fileSize);
    return textSample ? detectTextType(textSample) : null;
  } finally {
    fs.closeSync(handle);
  }
}

function validateUploadedContent(file) {
  const detectedTypeKey = detectUploadType(file.path);
  const expectedExtension = path.extname(String(file.originalname || '')).toLowerCase();
  const detectedType = detectedTypeKey ? uploadTypeByKey.get(detectedTypeKey) : null;
  const expectedType = supportedUploadTypes.find((type) => type.extensions.has(expectedExtension)) || null;
  const isCompatibleTextUpload = detectedType && expectedType
    && textUploadTypeKeys.has(detectedType.key)
    && textUploadTypeKeys.has(expectedType.key);

  if (!detectedType || (!detectedType.extensions.has(expectedExtension) && !isCompatibleTextUpload)) {
    throw createAdminValidationError('上传文件内容与文件类型不匹配，请检查后重试。', 'unsafe-upload-content');
  }

  const detectedMimeType = expectedExtension === '.xls'
    ? 'application/vnd.ms-excel'
    : expectedExtension === '.ppt'
      ? 'application/vnd.ms-powerpoint'
      : detectedType.mimeType;

  file.mimetype = detectedMimeType;
  file.detectedMimeType = detectedMimeType;
  file.detectedUploadType = detectedType.key;
  return file;
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

  const upload = multer({
    storage,
    fileFilter(req, file, cb) {
      if (!isAllowedUploadFilename(file.originalname)) {
        return cb(createAdminValidationError('不支持上传的文件类型，请上传图片或文档。', 'unsafe-upload-type'));
      }

      return cb(null, true);
    },
  }).single('file');

  return (req, res, cb) => upload(req, res, (error) => {
    if (error || !req.file) {
      return cb(error);
    }

    try {
      validateUploadedContent(req.file);
      return cb(null);
    } catch (validationError) {
      return cb(validationError);
    }
  });
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
  validateUploadedContent,
};
