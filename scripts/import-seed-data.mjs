import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { openDatabase } = require('../src/lib/db.js');
const { runMigrations } = require('../src/lib/migrations.js');
const { createSiteBootstrap } = require('../src/lib/site-bootstrap.js');
const { createSiteRepository } = require('../src/repositories/site-repository.js');
const { createCatalogRepository } = require('../src/repositories/catalog-repository.js');
const { createMediaRepository } = require('../src/repositories/media-repository.js');
const { createRedirectRepository } = require('../src/repositories/redirect-repository.js');
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
  if (!target) {
    return null;
  }
  return path.isAbsolute(target) ? target : path.join(projectRoot, target);
}

function loadSeed(seedPath) {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function countStats(seed) {
  return {
    navigationItems: toArray(seed.navigation).length,
    siteSections: toArray(seed.siteSections).length,
    mediaAssets: toArray(seed.mediaAssets).length,
    pages: toArray(seed.pages).length,
    products: toArray(seed.products).length,
    solutions: toArray(seed.solutions).length,
    news: toArray(seed.news).length,
    cases: toArray(seed.cases).length,
    redirects: toArray(seed.redirects).length,
  };
}

function resolveAssetStoragePath(uploadRoot, asset) {
  const relativePath = normalizeRelativeMediaPath(asset.relativePath || asset.storagePath || asset.filename);
  if (!relativePath) {
    throw new Error(`Asset ${asset.assetKey || asset.filename || '(unknown)'} is missing a safe relativePath.`);
  }

  const storagePath = path.join(uploadRoot, relativePath);
  return {
    relativePath,
    storagePath,
  };
}

function ensureAssetFiles(seed, uploadRoot) {
  const missingAssets = [];

  for (const asset of toArray(seed.mediaAssets)) {
    const { relativePath, storagePath } = resolveAssetStoragePath(uploadRoot, asset);
    if (!fs.existsSync(storagePath)) {
      missingAssets.push({
        assetKey: asset.assetKey,
        relativePath,
        storagePath,
        sourceUrl: asset.sourceUrl || null,
      });
    }
  }

  if (missingAssets.length > 0) {
    const details = missingAssets
      .map((asset) => `${asset.assetKey} -> ${path.relative(projectRoot, asset.storagePath)}`)
      .join(', ');
    throw new Error(`Missing local asset files for import: ${details}`);
  }
}

function clearSiteContent(db, siteKey) {
  const transaction = db.transaction((targetSiteKey) => {
    db.prepare('DELETE FROM redirect_rules WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM navigation_items WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM site_sections WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM products WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM solutions WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM pages WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM news_articles WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM case_studies WHERE site_key = ?').run(targetSiteKey);
    db.prepare('DELETE FROM media_assets WHERE site_key = ?').run(targetSiteKey);
  });

  transaction(siteKey);
}

function resolveAssetId(assetKeyMap, assetKey, fieldLabel) {
  if (!assetKey) {
    return null;
  }

  const assetId = assetKeyMap.get(assetKey);
  if (!assetId) {
    throw new Error(`Unknown asset key "${assetKey}" referenced by ${fieldLabel}.`);
  }
  return assetId;
}

function importSeedData({
  siteKey,
  seed,
  apply = false,
  databasePath,
  uploadRoot,
}) {
  if (!seed?.site?.siteKey) {
    throw new Error('Seed file must define site.siteKey.');
  }
  if (seed.site.siteKey !== siteKey) {
    throw new Error(`Seed siteKey ${seed.site.siteKey} does not match --site ${siteKey}.`);
  }

  ensureAssetFiles(seed, uploadRoot);

  const stats = countStats(seed);
  if (!apply) {
    return {
      siteKey,
      applied: false,
      databasePath,
      uploadRoot,
      stats,
    };
  }

  const db = openDatabase(databasePath);

  try {
    runMigrations(db);

    const { ensureSite } = createSiteBootstrap(db);
    const siteRepository = createSiteRepository(db);
    const catalogRepository = createCatalogRepository(db);
    const mediaRepository = createMediaRepository(db, { uploadRoot });
    const redirectRepository = createRedirectRepository(db);

    ensureSite(siteKey);

    const assetKeyMap = new Map();
    const writeTransaction = db.transaction(() => {
      clearSiteContent(db, siteKey);

      siteRepository.upsertSiteSettings({
        siteKey,
        brandName: seed.site.brandName,
        domain: seed.site.domain,
        seoTitle: seed.site.seoTitle ?? null,
        seoDescription: seed.site.seoDescription ?? null,
        contactEmail: seed.site.contactEmail ?? null,
        contactPhone: seed.site.contactPhone ?? null,
        contactAddress: seed.site.contactAddress ?? null,
      });

      siteRepository.replaceNavigation(siteKey, toArray(seed.navigation));

      for (const asset of toArray(seed.mediaAssets)) {
        const { storagePath } = resolveAssetStoragePath(uploadRoot, asset);
        const record = mediaRepository.createAsset({
          assetKey: asset.assetKey,
          siteKey: asset.siteKey || siteKey,
          sourceUrl: asset.sourceUrl ?? null,
          filename: asset.filename || path.basename(storagePath),
          mimeType: asset.mimeType || 'application/octet-stream',
          storagePath,
          altText: asset.altText ?? null,
          metadata: asset.metadata || {},
        });
        assetKeyMap.set(asset.assetKey, record.id);
      }

      for (const section of toArray(seed.siteSections)) {
        siteRepository.saveSection({
          siteKey,
          sectionKey: section.sectionKey,
          heading: section.heading ?? null,
          subheading: section.subheading ?? null,
          body: section.body ?? null,
          mediaAssetId: resolveAssetId(assetKeyMap, section.mediaAssetKey, `site section ${section.sectionKey}`),
          config: section.config || {},
          isPublished: section.isPublished !== false,
          publishedAt: section.publishedAt ?? null,
          sortOrder: section.sortOrder ?? 0,
        });
      }

      for (const page of toArray(seed.pages)) {
        catalogRepository.createPage({
          siteKey,
          path: page.path,
          title: page.title,
          summary: page.summary ?? null,
          bodyHtml: page.bodyHtml ?? null,
          attachmentMediaId: resolveAssetId(assetKeyMap, page.attachmentAssetKey, `page ${page.path}`),
          seoTitle: page.seoTitle ?? null,
          seoDescription: page.seoDescription ?? null,
          sortOrder: page.sortOrder ?? 100,
          publishState: page.publishState ?? 'draft',
          publishedAt: page.publishedAt ?? null,
        });
      }

      for (const product of toArray(seed.products)) {
        catalogRepository.createProduct({
          siteKey,
          slug: product.slug,
          title: product.title,
          summary: product.summary ?? null,
          bodyHtml: product.bodyHtml ?? null,
          brochureMediaId: resolveAssetId(assetKeyMap, product.brochureAssetKey, `product ${product.slug} brochure`),
          attachmentMediaId: resolveAssetId(assetKeyMap, product.attachmentAssetKey, `product ${product.slug} attachment`),
          seoTitle: product.seoTitle ?? null,
          seoDescription: product.seoDescription ?? null,
          sortOrder: product.sortOrder ?? 100,
          publishState: product.publishState ?? 'draft',
          publishedAt: product.publishedAt ?? null,
        });
      }

      for (const solution of toArray(seed.solutions)) {
        catalogRepository.createSolution({
          siteKey,
          slug: solution.slug,
          title: solution.title,
          summary: solution.summary ?? null,
          bodyHtml: solution.bodyHtml ?? null,
          attachmentMediaId: resolveAssetId(assetKeyMap, solution.attachmentAssetKey, `solution ${solution.slug}`),
          seoTitle: solution.seoTitle ?? null,
          seoDescription: solution.seoDescription ?? null,
          sortOrder: solution.sortOrder ?? 100,
          publishState: solution.publishState ?? 'draft',
          publishedAt: solution.publishedAt ?? null,
        });
      }

      for (const article of toArray(seed.news)) {
        catalogRepository.createNewsArticle({
          siteKey,
          slug: article.slug,
          title: article.title,
          summary: article.summary ?? null,
          bodyHtml: article.bodyHtml ?? null,
          heroMediaId: resolveAssetId(assetKeyMap, article.heroAssetKey, `news ${article.slug}`),
          seoTitle: article.seoTitle ?? null,
          seoDescription: article.seoDescription ?? null,
          sortOrder: article.sortOrder ?? 100,
          publishState: article.publishState ?? 'draft',
          publishedAt: article.publishedAt ?? null,
        });
      }

      for (const caseStudy of toArray(seed.cases)) {
        catalogRepository.createCaseStudy({
          siteKey,
          slug: caseStudy.slug,
          title: caseStudy.title,
          summary: caseStudy.summary ?? null,
          bodyHtml: caseStudy.bodyHtml ?? null,
          attachmentMediaId: resolveAssetId(assetKeyMap, caseStudy.attachmentAssetKey, `case ${caseStudy.slug}`),
          seoTitle: caseStudy.seoTitle ?? null,
          seoDescription: caseStudy.seoDescription ?? null,
          sortOrder: caseStudy.sortOrder ?? 100,
          publishState: caseStudy.publishState ?? 'draft',
          publishedAt: caseStudy.publishedAt ?? null,
        });
      }

      for (const redirect of toArray(seed.redirects)) {
        redirectRepository.createRule({
          siteKey,
          sourcePath: redirect.sourcePath,
          sourceQuery: redirect.sourceQuery ?? '',
          targetPath: redirect.targetPath,
          statusCode: redirect.statusCode ?? 301,
          isActive: redirect.isActive !== false,
        });
      }
    });

    writeTransaction();

    return {
      siteKey,
      applied: true,
      databasePath,
      uploadRoot,
      stats,
    };
  } finally {
    db.close();
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteKey = args.site;
  const seedPath = resolveProjectPath(args.seed, siteKey ? path.join('data', 'seeds', `${siteKey}.json`) : null);
  const databasePath = resolveProjectPath(args['database-path'], path.join('data', 'content.db'));
  const uploadRoot = resolveProjectPath(args['upload-root'], path.join('public', 'uploads'));
  const apply = Boolean(args.apply);

  if (!siteKey) {
    throw new Error('--site is required.');
  }
  if (!seedPath) {
    throw new Error('--seed is required.');
  }

  const seed = loadSeed(seedPath);
  const result = importSeedData({
    siteKey,
    seed,
    apply,
    databasePath,
    uploadRoot,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
