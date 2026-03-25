const test = require('node:test');
const assert = require('node:assert/strict');

const { createTestDb, createSeededDb } = require('./helpers/create-seeded-db');
const { runMigrations } = require('../src/lib/migrations');
const { createCatalogRepository } = require('../src/repositories/catalog-repository');
const { createSiteRepository } = require('../src/repositories/site-repository');
const { createMediaRepository } = require('../src/repositories/media-repository');
const { createRedirectRepository } = require('../src/repositories/redirect-repository');
const { createAdminRepository } = require('../src/repositories/admin-repository');

test('repository layer can create a dma product and list it by site', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  catalog.createProduct({
    siteKey: 'dma',
    slug: 'dma-lite',
    title: 'DMA Lite',
    summary: 'Leakage monitoring',
    sortOrder: 2,
  });
  catalog.createProduct({
    siteKey: 'dma',
    slug: 'dma-pro',
    title: 'DMA Pro',
    summary: 'Advanced monitoring',
    sortOrder: 1,
  });

  assert.deepEqual(
    catalog.listProducts('dma').map((item) => item.slug),
    ['dma-pro', 'dma-lite'],
  );
});

test('site repository uses hero site section as the homepage banner source of truth', () => {
  const db = createTestDb();
  runMigrations(db);
  const sites = createSiteRepository(db);

  sites.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA Lite',
    domain: 'dma.example.com',
    seoTitle: 'DMA Lite',
  });

  sites.saveSection({
    siteKey: 'dma',
    sectionKey: 'hero',
    heading: 'Protect every drop',
    body: 'AI-powered leakage monitoring',
    config: {
      ctaLabel: 'Book a demo',
      image: '/media/dma-hero.png',
    },
  });

  sites.replaceNavigation('dma', [
    { key: 'products', label: 'Products', href: '/products', position: 1 },
    { label: 'DMA Lite', href: '/products/dma-lite', position: 2, parentKey: 'products' },
    { label: 'News', href: '/news', position: 3 },
  ]);

  assert.equal(sites.getSiteSettings('dma').brandName, 'DMA Lite');
  assert.equal(sites.listHomepageBanners('dma')[0].heading, 'Protect every drop');
  const navigation = sites.listNavigation('dma');
  assert.equal(navigation.length, 3);
  assert.notEqual(navigation[1].parentId, null);

  sites.replaceNavigation('dma', navigation);

  assert.notEqual(sites.listNavigation('dma')[1].parentId, null);
});

test('media and redirect repositories support site-scoped queries with global fallbacks', () => {
  const db = createTestDb();
  runMigrations(db);
  const media = createMediaRepository(db);
  const redirects = createRedirectRepository(db);

  media.createAsset({
    assetKey: 'global-logo',
    siteKey: null,
    filename: 'logo.png',
    mimeType: 'image/png',
    storagePath: '/uploads/logo.png',
  });
  media.createAsset({
    assetKey: 'dma-brochure',
    siteKey: 'dma',
    filename: 'dma-lite.pdf',
    mimeType: 'application/pdf',
    storagePath: '/uploads/dma-lite.pdf',
  });

  redirects.createRule({
    siteKey: 'dma',
    sourcePath: '/col.jsp',
    sourceQuery: 'id=101',
    targetPath: '/products/dma-lite',
    statusCode: 301,
  });

  assert.deepEqual(
    media.listAssets({ siteKey: 'dma' }).map((asset) => asset.assetKey),
    ['dma-brochure', 'global-logo'],
  );
  assert.equal(redirects.listRules('dma')[0].targetPath, '/products/dma-lite');
});

test('catalog repository preserves news hero media ids', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);
  const media = createMediaRepository(db);

  const hero = media.createAsset({
    assetKey: 'dma-news-hero',
    siteKey: 'dma',
    filename: 'smart-water.png',
    mimeType: 'image/png',
    storagePath: '/uploads/smart-water.png',
  });

  catalog.createNewsArticle({
    siteKey: 'dma',
    slug: 'smart-water',
    title: 'Smart Water',
    summary: 'AI update',
    heroMediaId: hero.id,
  });

  assert.equal(catalog.listNewsArticles('dma')[0].heroMediaId, hero.id);
});

test('seeded helper provisions default admins and both site settings rows', () => {
  const db = createSeededDb();
  const admins = createAdminRepository(db);
  const sites = createSiteRepository(db);

  assert.equal(admins.listAdmins().length, 1);
  assert.equal(admins.listAdmins()[0].username, 'admin');
  assert.deepEqual(
    sites.listSiteSettings().map((item) => item.siteKey),
    ['bigfoot', 'dma'],
  );
});

test('pages cannot attach a parent from another site', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  const dmaPage = catalog.createPage({
    siteKey: 'dma',
    path: '/dma-root',
    slug: 'dma-root',
    title: 'DMA Root',
  });

  assert.throws(
    () => catalog.createPage({
      siteKey: 'bigfoot',
      parentId: dmaPage.id,
      path: '/bigfoot-child',
      slug: 'bigfoot-child',
      title: 'Bigfoot Child',
    }),
    /same site/,
  );
});

test('pages derive slug from path when one is not supplied', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  const page = catalog.createPage({
    siteKey: 'dma',
    path: '/products/dma-lite',
    title: 'DMA Lite page',
  });

  assert.equal(page.slug, 'dma-lite');
});
