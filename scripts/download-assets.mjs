import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeRelativeMediaPath } = require('../src/lib/media-paths.js');
const mime = require('mime-types');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function resolveProjectPath(value, fallback) {
  const target = value || fallback;
  return path.isAbsolute(target) ? target : path.join(projectRoot, target);
}

function loadSeed(seedPath) {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveAssetTarget(uploadRoot, asset) {
  const relativePath = normalizeRelativeMediaPath(asset.relativePath || asset.storagePath || asset.filename);
  if (!relativePath) {
    throw new Error(`Asset ${asset.assetKey || asset.filename || '(unknown)'} is missing a safe relativePath.`);
  }
  return {
    relativePath,
    storagePath: path.join(uploadRoot, relativePath),
  };
}

function stripContentTypeParameters(contentType) {
  if (!contentType) {
    return null;
  }

  return contentType.split(';', 1)[0].trim().toLowerCase() || null;
}

function inferExpectedKind(asset) {
  const filename = asset.filename || asset.relativePath || asset.storagePath || '';
  const extension = path.extname(filename).toLowerCase();
  const declaredMimeType = stripContentTypeParameters(asset.mimeType) || stripContentTypeParameters(mime.lookup(filename));

  if (extension === '.pdf' || declaredMimeType === 'application/pdf') {
    return 'pdf';
  }
  if (extension === '.png' || declaredMimeType === 'image/png') {
    return 'png';
  }
  if (extension === '.jpg' || extension === '.jpeg' || declaredMimeType === 'image/jpeg') {
    return 'jpeg';
  }
  if (extension === '.svg' || declaredMimeType === 'image/svg+xml') {
    return 'svg';
  }
  if (extension === '.apk' || declaredMimeType === 'application/vnd.android.package-archive') {
    return 'apk';
  }

  return null;
}

function inferKindFromContentType(contentType) {
  const normalized = stripContentTypeParameters(contentType);
  if (!normalized || normalized === 'application/octet-stream') {
    return null;
  }

  if (normalized === 'application/pdf') {
    return 'pdf';
  }
  if (normalized === 'image/png') {
    return 'png';
  }
  if (normalized === 'image/jpeg') {
    return 'jpeg';
  }
  if (normalized === 'image/svg+xml') {
    return 'svg';
  }
  if (
    normalized === 'application/vnd.android.package-archive'
    || normalized === 'application/zip'
    || normalized === 'application/x-zip-compressed'
  ) {
    return 'apk';
  }

  return null;
}

function inferKindFromBuffer(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return 'apk';
  }

  const leadingText = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8').trimStart().toLowerCase();
  if (leadingText.startsWith('<svg') || (leadingText.startsWith('<?xml') && leadingText.includes('<svg'))) {
    return 'svg';
  }

  return null;
}

function validateDownloadedPayload(asset, response, buffer) {
  const expectedKind = inferExpectedKind(asset);
  if (!expectedKind) {
    return;
  }

  const contentType = stripContentTypeParameters(response.headers.get('content-type'));
  const contentTypeKind = inferKindFromContentType(contentType);
  const bufferKind = inferKindFromBuffer(buffer);
  const reasons = [];

  if (contentTypeKind && contentTypeKind !== expectedKind) {
    reasons.push(`content-type ${contentType} does not match expected ${expectedKind}`);
  }
  if (bufferKind && bufferKind !== expectedKind) {
    reasons.push(`payload signature ${bufferKind} does not match expected ${expectedKind}`);
  }
  if (contentTypeKind && bufferKind && contentTypeKind !== bufferKind) {
    reasons.push(`content-type ${contentTypeKind} disagrees with payload signature ${bufferKind}`);
  }

  if (reasons.length > 0) {
    throw new Error(`Refusing to replace ${asset.assetKey || asset.filename || '(unknown asset)'}: ${reasons.join('; ')}`);
  }

  if (bufferKind !== expectedKind) {
    const observed = [];
    if (contentTypeKind === expectedKind) {
      observed.push(`content-type ${contentType} matched, but payload signature did not confirm ${expectedKind}`);
    } else {
      observed.push(contentType ? `content-type ${contentType} was not a recognized ${expectedKind} signal` : 'content-type header was missing');
    }
    observed.push('payload signature was unrecognized');
    throw new Error(`Refusing to replace ${asset.assetKey || asset.filename || '(unknown asset)'}: expected ${expectedKind}, but the payload could not be confirmed (${observed.join('; ')})`);
  }
}

function writeFileAtomically(storagePath, buffer) {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const tempPath = `${storagePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    fs.writeFileSync(tempPath, buffer, { flag: 'wx' });
    fs.renameSync(tempPath, storagePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors and surface the original failure below.
    }
    throw error;
  }
}

async function downloadAssets({
  seed,
  siteKey,
  uploadRoot,
  apply = false,
  force = false,
  assetKey = null,
}) {
  const candidates = toArray(seed.mediaAssets)
    .filter((asset) => (siteKey ? (asset.siteKey || seed.site?.siteKey) === siteKey : true))
    .filter((asset) => (assetKey ? asset.assetKey === assetKey : true))
    .filter((asset) => /^https?:\/\//i.test(asset.sourceUrl || ''));

  const results = [];

  for (const asset of candidates) {
    const { relativePath, storagePath } = resolveAssetTarget(uploadRoot, asset);
    const exists = fs.existsSync(storagePath);
    if (exists && !force) {
      results.push({
        assetKey: asset.assetKey,
        relativePath,
        status: 'skipped',
      });
      continue;
    }

    if (!apply) {
      results.push({
        assetKey: asset.assetKey,
        relativePath,
        status: exists ? 'would-replace' : 'would-download',
      });
      continue;
    }

    const response = await fetch(asset.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${asset.assetKey} from ${asset.sourceUrl}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    validateDownloadedPayload(asset, response, buffer);
    writeFileAtomically(storagePath, buffer);
    results.push({
      assetKey: asset.assetKey,
      relativePath,
      status: exists ? 'replaced' : 'downloaded',
      bytes: buffer.length,
    });
  }

  return {
    siteKey: siteKey || seed.site?.siteKey || null,
    applied: apply,
    uploadRoot,
    count: results.length,
    results,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteKey = args.site || null;
  const seedPath = resolveProjectPath(args.seed, siteKey ? path.join('data', 'seeds', `${siteKey}.json`) : path.join('data', 'seeds', 'dma.json'));
  const uploadRoot = resolveProjectPath(args['upload-root'], path.join('public', 'uploads'));
  const seed = loadSeed(seedPath);

  const result = await downloadAssets({
    seed,
    siteKey,
    uploadRoot,
    apply: Boolean(args.apply),
    force: Boolean(args.force),
    assetKey: args['asset-key'] || null,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
