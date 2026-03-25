import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeRelativeMediaPath } = require('../src/lib/media-paths.js');

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
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, buffer);
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
