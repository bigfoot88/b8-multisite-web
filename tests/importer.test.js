const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { createDatabase } = require('../src/lib/db');
const { createCatalogRepository } = require('../src/repositories/catalog-repository');
const { createMediaRepository } = require('../src/repositories/media-repository');
const { createRedirectRepository } = require('../src/repositories/redirect-repository');
const { createSiteRepository } = require('../src/repositories/site-repository');

const repoRoot = path.join(__dirname, '..');
const uploadRoot = path.join(repoRoot, 'public', 'uploads');

function runImporter(args, env = {}) {
  const stdout = execFileSync(process.execPath, ['scripts/import-seed-data.mjs', ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'pipe',
    encoding: 'utf8',
  });

  return JSON.parse(stdout);
}

test('import-seed-data imports curated dma and bigfoot content with stable public slugs and linked local assets', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-import-seed-'));
  const databasePath = path.join(tempDir, 'content.db');

  try {
    const dmaResult = runImporter([
      '--site',
      'dma',
      '--seed',
      'data/seeds/dma.json',
      '--database-path',
      databasePath,
      '--apply',
    ]);
    const bigfootResult = runImporter([
      '--site',
      'bigfoot',
      '--seed',
      'data/seeds/bigfoot.json',
      '--database-path',
      databasePath,
      '--apply',
    ]);

    assert.equal(dmaResult.siteKey, 'dma');
    assert.equal(bigfootResult.siteKey, 'bigfoot');
    assert.equal(dmaResult.applied, true);
    assert.equal(bigfootResult.applied, true);
    assert.ok(dmaResult.stats.mediaAssets >= 4);
    assert.ok(dmaResult.stats.pages >= 3);
    assert.ok(bigfootResult.stats.products >= 1);
    assert.ok(bigfootResult.stats.redirects >= 5);

    const db = createDatabase(databasePath);
    const siteRepository = createSiteRepository(db);
    const catalogRepository = createCatalogRepository(db);
    const mediaRepository = createMediaRepository(db, { uploadRoot });
    const redirectRepository = createRedirectRepository(db);

    const dmaSite = siteRepository.getSiteSettings('dma');
    assert.equal(dmaSite.brandName, '智灵科技');
    assert.equal(dmaSite.domain, 'dma.b8water.com');
    assert.match(dmaSite.contactPhone || '', /400-660-3328/);
    assert.match(dmaSite.contactAddress || '', /深圳/);

    const bigfootSite = siteRepository.getSiteSettings('bigfoot');
    assert.equal(bigfootSite.brandName, '中山市同创科技发展有限公司');
    assert.equal(bigfootSite.domain, 'www.chinabigfoot.com');
    assert.match(bigfootSite.contactAddress || '', /中山市/);

    assert.ok(siteRepository.listNavigation('dma').length >= 6);
    assert.ok(siteRepository.listNavigation('bigfoot').length >= 5);
    assert.equal(siteRepository.getSection('dma', 'hero')?.heading, 'DMA Lite · 夜间最小流量+分区漏损监测方案');
    assert.equal(siteRepository.getSection('bigfoot', 'hero')?.heading, '选择B8ERP，开启智能水务新纪元');

    const dmaProduct = catalogRepository.findPublishedProductBySlug('dma', 'dma-lite');
    assert.ok(dmaProduct);
    assert.match(dmaProduct.title, /DMA Lite/);
    assert.ok(dmaProduct.brochureMediaId);
    assert.ok(dmaProduct.attachmentMediaId);

    const dmaSolution = catalogRepository.findPublishedSolutionBySlug('dma', 'dma-lite-solution');
    assert.ok(dmaSolution);
    assert.match(dmaSolution.bodyHtml || '', /分区|漏损|夜间最小流量/);

    const dmaNews = catalogRepository.findPublishedNewsArticleBySlug('dma', 'mnf-observation');
    assert.ok(dmaNews);
    assert.match(dmaNews.bodyHtml || '', /漏损精准化治理观察/);
    assert.ok(dmaNews.heroMediaId);

    const dmaCase = catalogRepository.findPublishedCaseStudyBySlug('dma', 'qingyuan-water');
    assert.ok(dmaCase);
    assert.match(dmaCase.bodyHtml || '', /清远/);

    const dmaContactPage = catalogRepository.findPublishedPageByPath('dma', '/contact');
    assert.ok(dmaContactPage);
    assert.match(dmaContactPage.bodyHtml || '', /科智西路|联系电话/);

    const bigfootProduct = catalogRepository.findPublishedProductBySlug('bigfoot', 'billing-suite');
    assert.ok(bigfootProduct);
    assert.match(bigfootProduct.bodyHtml || '', /收费系统|营收/);

    const bigfootSolution = catalogRepository.findPublishedSolutionBySlug('bigfoot', 'smart-water');
    assert.ok(bigfootSolution);
    assert.match(bigfootSolution.bodyHtml || '', /抄表|漏损|调度/);

    const bigfootNews = catalogRepository.findPublishedNewsArticleBySlug('bigfoot', 'contract-water-saving');
    assert.ok(bigfootNews);
    assert.match(bigfootNews.bodyHtml || '', /节水/);

    const bigfootCase = catalogRepository.findPublishedCaseStudyBySlug('bigfoot', 'zhongshan-water');
    assert.ok(bigfootCase);
    assert.match(bigfootCase.bodyHtml || '', /中山/);

    const dmaHeroAsset = mediaRepository.findByAssetKey('dma-hero-monitoring');
    assert.ok(dmaHeroAsset);
    assert.equal(path.relative(uploadRoot, dmaHeroAsset.storagePath).startsWith('..'), false);
    assert.equal(fs.existsSync(dmaHeroAsset.storagePath), true);

    const bigfootHeroAsset = mediaRepository.findByAssetKey('bigfoot-hero-b8erp');
    assert.ok(bigfootHeroAsset);
    assert.equal(fs.existsSync(bigfootHeroAsset.storagePath), true);

    assert.equal(
      redirectRepository.findActiveRule('dma', '/nd.jsp', 'id=111')?.targetPath,
      '/news/mnf-observation',
    );
    assert.equal(
      redirectRepository.findActiveRule('bigfoot', '/pd.jsp', 'id=16')?.targetPath,
      '/products/billing-suite',
    );

    db.close();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
