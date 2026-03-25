const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

test('site repository normalizes site domains on write and lookup below the route layer', () => {
  const db = createTestDb();
  runMigrations(db);
  const sites = createSiteRepository(db);

  const saved = sites.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'Foo.Local',
  });

  assert.equal(saved.domain, 'foo.local');
  assert.equal(
    db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('dma').domain,
    'foo.local',
  );
  assert.equal(sites.getSiteSettingsByDomain('FOO.LOCAL')?.siteKey, 'dma');
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

test('media repository can batch load assets by id for public rendering', () => {
  const db = createTestDb();
  runMigrations(db);
  const media = createMediaRepository(db);

  const globalLogo = media.createAsset({
    assetKey: 'global-logo',
    siteKey: null,
    sourceUrl: 'https://cdn.example.com/logo.png',
    filename: 'logo.png',
    mimeType: 'image/png',
    storagePath: '/uploads/logo.png',
  });
  const dmaBrochure = media.createAsset({
    assetKey: 'dma-brochure',
    siteKey: 'dma',
    filename: 'dma-lite.pdf',
    mimeType: 'application/pdf',
    storagePath: '/uploads/dma-lite.pdf',
  });

  assert.deepEqual(
    media.findByIds([dmaBrochure.id, 9999, globalLogo.id]).map((asset) => ({
      assetKey: asset.assetKey,
      publicUrl: asset.publicUrl,
    })),
    [
      { assetKey: 'global-logo', publicUrl: 'https://cdn.example.com/logo.png' },
      { assetKey: 'dma-brochure', publicUrl: '/media/dma-lite.pdf' },
    ],
  );
});

test('media repository preserves nested upload paths in public urls', (t) => {
  const db = createTestDb();
  runMigrations(db);
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-media-public-url-'));
  t.after(() => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  });
  const media = createMediaRepository(db, { uploadRoot });

  const nestedAsset = media.createAsset({
    assetKey: 'dma-nested-brochure',
    siteKey: 'dma',
    filename: 'brochure.pdf',
    mimeType: 'application/pdf',
    storagePath: path.join(uploadRoot, 'imported/2026/03/brochure.pdf'),
  });

  assert.equal(nestedAsset.publicUrl, '/media/imported/2026/03/brochure.pdf');
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

test('catalog repository rejects blank slugs and paths before writing', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  const invalidCreates = [
    {
      label: 'product slug',
      run: () => catalog.createProduct({ siteKey: 'dma', slug: '', title: 'DMA Product' }),
      message: /Slug 不能为空，请填写后重试。/,
    },
    {
      label: 'solution slug',
      run: () => catalog.createSolution({ siteKey: 'dma', slug: '', title: 'DMA Solution' }),
      message: /Slug 不能为空，请填写后重试。/,
    },
    {
      label: 'news slug',
      run: () => catalog.createNewsArticle({ siteKey: 'dma', slug: '', title: 'DMA News' }),
      message: /Slug 不能为空，请填写后重试。/,
    },
    {
      label: 'case slug',
      run: () => catalog.createCaseStudy({ siteKey: 'dma', slug: '', title: 'DMA Case' }),
      message: /Slug 不能为空，请填写后重试。/,
    },
    {
      label: 'page path',
      run: () => catalog.createPage({ siteKey: 'dma', path: '', title: 'DMA Page' }),
      message: /页面路径不能为空，请填写后重试。/,
    },
  ];

  for (const scenario of invalidCreates) {
    assert.throws(scenario.run, (error) => {
      assert.equal(error.statusCode, 400, scenario.label);
      assert.match(error.message, scenario.message, scenario.label);
      return true;
    });
  }

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM site_settings').get().count, 0);

  const product = catalog.createProduct({
    siteKey: 'dma',
    slug: 'dma-product',
    title: 'DMA Product',
  });
  const page = catalog.createPage({
    siteKey: 'dma',
    path: '/dma-page',
    title: 'DMA Page',
  });

  assert.throws(
    () => catalog.updateProduct('dma', product.id, { slug: '' }),
    /Slug 不能为空，请填写后重试。/,
  );
  assert.throws(
    () => catalog.updatePage('dma', page.id, { path: '' }),
    /页面路径不能为空，请填写后重试。/,
  );
});

test('catalog repository rejects missing media references before writing', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);
  const media = createMediaRepository(db);

  const brochure = media.createAsset({
    assetKey: 'dma-brochure',
    siteKey: 'dma',
    filename: 'dma.pdf',
    mimeType: 'application/pdf',
    storagePath: '/uploads/dma.pdf',
  });
  const attachment = media.createAsset({
    assetKey: 'dma-attachment',
    siteKey: 'dma',
    filename: 'attach.pdf',
    mimeType: 'application/pdf',
    storagePath: '/uploads/attach.pdf',
  });
  const hero = media.createAsset({
    assetKey: 'dma-hero',
    siteKey: 'dma',
    filename: 'hero.png',
    mimeType: 'image/png',
    storagePath: '/uploads/hero.png',
  });
  const siteCountBeforeInvalidCreates = db.prepare('SELECT COUNT(*) AS count FROM site_settings').get().count;

  const invalidCreates = [
    {
      label: 'product brochure',
      run: () => catalog.createProduct({ siteKey: 'dma', slug: 'product-brochure', title: 'DMA Product', brochureMediaId: 9999 }),
      message: /宣传册媒体资源不存在，请重新选择。/,
    },
    {
      label: 'product brochure zero',
      run: () => catalog.createProduct({ siteKey: 'dma', slug: 'product-brochure-zero', title: 'DMA Product', brochureMediaId: 0 }),
      message: /宣传册媒体资源不存在，请重新选择。/,
    },
    {
      label: 'product attachment',
      run: () => catalog.createProduct({ siteKey: 'dma', slug: 'product-attachment', title: 'DMA Product', attachmentMediaId: 9999 }),
      message: /附件媒体资源不存在，请重新选择。/,
    },
    {
      label: 'page attachment',
      run: () => catalog.createPage({ siteKey: 'dma', path: '/page-attachment', title: 'DMA Page', attachmentMediaId: 9999 }),
      message: /附件媒体资源不存在，请重新选择。/,
    },
    {
      label: 'news hero',
      run: () => catalog.createNewsArticle({ siteKey: 'dma', slug: 'news-hero', title: 'DMA News', heroMediaId: 9999 }),
      message: /头图媒体资源不存在，请重新选择。/,
    },
  ];

  for (const scenario of invalidCreates) {
    assert.throws(scenario.run, (error) => {
      assert.equal(error.statusCode, 400, scenario.label);
      assert.match(error.message, scenario.message, scenario.label);
      return true;
    });
  }

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM site_settings').get().count, siteCountBeforeInvalidCreates);

  const product = catalog.createProduct({
    siteKey: 'dma',
    slug: 'product-with-media',
    title: 'DMA Product',
    brochureMediaId: brochure.id,
    attachmentMediaId: attachment.id,
  });
  const page = catalog.createPage({
    siteKey: 'dma',
    path: '/page-with-media',
    title: 'DMA Page',
    attachmentMediaId: attachment.id,
  });
  const article = catalog.createNewsArticle({
    siteKey: 'dma',
    slug: 'news-with-hero',
    title: 'DMA News',
    heroMediaId: hero.id,
  });

  assert.throws(
    () => catalog.updateProduct('dma', product.id, { brochureMediaId: 9999 }),
    /宣传册媒体资源不存在，请重新选择。/,
  );
  assert.throws(
    () => catalog.updateProduct('dma', product.id, { brochureMediaId: 0 }),
    /宣传册媒体资源不存在，请重新选择。/,
  );
  assert.throws(
    () => catalog.updateProduct('dma', product.id, { attachmentMediaId: 9999 }),
    /附件媒体资源不存在，请重新选择。/,
  );
  assert.throws(
    () => catalog.updatePage('dma', page.id, { attachmentMediaId: 9999 }),
    /附件媒体资源不存在，请重新选择。/,
  );
  assert.throws(
    () => catalog.updateNewsArticle('dma', article.id, { heroMediaId: 9999 }),
    /头图媒体资源不存在，请重新选择。/,
  );
});

test('site repository rejects cross-site section media on save and update', () => {
  const db = createTestDb();
  runMigrations(db);
  const sites = createSiteRepository(db);
  const media = createMediaRepository(db);

  const dmaAsset = media.createAsset({
    assetKey: 'dma-section-media',
    siteKey: 'dma',
    filename: 'dma-section.png',
    mimeType: 'image/png',
    storagePath: '/uploads/dma-section.png',
  });
  const bigfootAsset = media.createAsset({
    assetKey: 'bigfoot-section-media',
    siteKey: 'bigfoot',
    filename: 'bigfoot-section.png',
    mimeType: 'image/png',
    storagePath: '/uploads/bigfoot-section.png',
  });

  assert.throws(
    () => sites.saveSection({
      siteKey: 'dma',
      sectionKey: 'cross-site-create',
      heading: 'Cross-site create',
      mediaAssetId: bigfootAsset.id,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /模块媒体资源必须属于当前站点或全局素材，请重新选择。/);
      return true;
    },
  );

  assert.equal(sites.getSection('dma', 'cross-site-create'), null);

  const saved = sites.saveSection({
    siteKey: 'dma',
    sectionKey: 'hero',
    heading: 'DMA hero',
    mediaAssetId: dmaAsset.id,
  });

  assert.equal(saved.mediaAssetId, dmaAsset.id);

  assert.throws(
    () => sites.saveSection({
      siteKey: 'dma',
      sectionKey: 'hero',
      heading: 'Broken hero',
      mediaAssetId: bigfootAsset.id,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /模块媒体资源必须属于当前站点或全局素材，请重新选择。/);
      return true;
    },
  );

  const unchanged = sites.getSection('dma', 'hero');
  assert.equal(unchanged.heading, 'DMA hero');
  assert.equal(unchanged.mediaAssetId, dmaAsset.id);
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
  assert.deepEqual(
    sites.listNavigation('dma').map((item) => item.href),
    ['/solutions', '/cases', '/news', '/contact'],
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

test('hierarchical page lookup does not use the root page as a catch-all fallback', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  catalog.createPage({
    siteKey: 'dma',
    path: '/',
    title: 'DMA Root Page',
    publishState: 'published',
  });
  catalog.createPage({
    siteKey: 'dma',
    path: '/about/history',
    title: 'DMA History',
    publishState: 'published',
  });

  assert.equal(
    catalog.findPublishedPageByHierarchicalPath('dma', '/about/history/timeline')?.path,
    '/about/history',
  );
  assert.equal(
    catalog.findPublishedPageByHierarchicalPath('dma', '/missing/branch'),
    null,
  );
});

test('repository layer rejects unsupported site keys', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);
  const sites = createSiteRepository(db);

  assert.throws(
    () => catalog.createProduct({
      siteKey: 'rogue',
      slug: 'rogue-product',
      title: 'Rogue Product',
    }),
    /siteKey/i,
  );

  assert.throws(
    () => sites.upsertSiteSettings({
      siteKey: 'rogue',
      brandName: 'Rogue',
      domain: 'rogue.example.com',
    }),
    /siteKey/i,
  );
});

test('schema rejects unsupported site keys in site settings', () => {
  const db = createTestDb();
  runMigrations(db);

  assert.throws(
    () => db.prepare(`
      INSERT INTO site_settings (site_key, brand_name, domain)
      VALUES ('rogue', 'Rogue', 'rogue.example.com')
    `).run(),
    /siteKey|constraint failed/i,
  );
});

test('schema rejects duplicate normalized domains across sites', () => {
  const db = createTestDb();
  runMigrations(db);

  db.prepare(`
    INSERT INTO site_settings (site_key, brand_name, domain)
    VALUES ('dma', 'DMA', 'Foo.Local')
  `).run();

  assert.throws(
    () => db.prepare(`
      INSERT INTO site_settings (site_key, brand_name, domain)
      VALUES ('bigfoot', 'Bigfoot', 'foo.local')
    `).run(),
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i,
  );

  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM site_settings WHERE lower(domain) = ?').get('foo.local').count,
    1,
  );
});

test('migrations block legacy databases with duplicate normalized site domains before applying schema indexes', () => {
  const db = createTestDb();
  db.exec(`
    CREATE TABLE site_settings (
      site_key TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO site_settings (site_key, brand_name, domain)
    VALUES
      ('dma', 'DMA', 'Foo.Local'),
      ('bigfoot', 'Bigfoot', 'foo.local');
  `);

  assert.throws(() => runMigrations(db), (error) => {
    assert.equal(error.code, 'LEGACY_DUPLICATE_SITE_DOMAINS');
    assert.match(error.message, /duplicate normalized site domains/i);
    assert.match(error.message, /resolve .*site_settings/i);
    assert.doesNotMatch(error.message, /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i);
    return true;
  });
});

test('redirect schema defaults to permanent redirects', () => {
  const db = createTestDb();
  runMigrations(db);
  const sites = createSiteRepository(db);
  sites.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.example.com',
  });

  const info = db.prepare(`
    INSERT INTO redirect_rules (site_key, source_path, target_path)
    VALUES ('dma', '/legacy', '/new-home')
  `).run();
  const row = db.prepare('SELECT status_code FROM redirect_rules WHERE id = ?').get(info.lastInsertRowid);

  assert.equal(row.status_code, 301);
});

test('migrations upgrade legacy site and redirect schema constraints', () => {
  const db = createTestDb();
  db.exec(`
    CREATE TABLE site_settings (
      site_key TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      seo_title TEXT,
      seo_description TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      contact_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE redirect_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_key TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_query TEXT NOT NULL DEFAULT '',
      target_path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 302,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(site_key, source_path, source_query),
      FOREIGN KEY(site_key) REFERENCES site_settings(site_key) ON DELETE CASCADE
    );
  `);

  runMigrations(db);

  assert.throws(
    () => db.prepare(`
      INSERT INTO site_settings (site_key, brand_name, domain)
      VALUES ('rogue', 'Rogue', 'rogue.example.com')
    `).run(),
    /siteKey|constraint failed/i,
  );

  db.prepare(`
    INSERT INTO site_settings (site_key, brand_name, domain)
    VALUES ('dma', 'DMA', 'dma.example.com')
  `).run();
  assert.throws(
    () => db.prepare(`
      INSERT INTO site_settings (site_key, brand_name, domain)
      VALUES ('bigfoot', 'Bigfoot', 'DMA.EXAMPLE.COM')
    `).run(),
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i,
  );
  const info = db.prepare(`
    INSERT INTO redirect_rules (site_key, source_path, target_path)
    VALUES ('dma', '/legacy-2', '/new-home-2')
  `).run();

  assert.equal(
    db.prepare('SELECT status_code FROM redirect_rules WHERE id = ?').get(info.lastInsertRowid).status_code,
    301,
  );
});

test('media repository rejects empty-string site filters', () => {
  const db = createTestDb();
  runMigrations(db);
  const media = createMediaRepository(db);

  assert.throws(
    () => media.createAsset({
      assetKey: 'empty-site-key',
      siteKey: '',
      filename: 'logo.png',
      mimeType: 'image/png',
      storagePath: '/uploads/logo.png',
    }),
    /siteKey/i,
  );

  assert.throws(
    () => media.listAssets({ siteKey: '' }),
    /siteKey/i,
  );
});
