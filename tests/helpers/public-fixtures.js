const fs = require('node:fs');
const path = require('node:path');

const { createApp } = require('../../src/app');
const { createDatabase } = require('../../src/lib/db');
const { createCatalogRepository } = require('../../src/repositories/catalog-repository');
const { createMediaRepository } = require('../../src/repositories/media-repository');
const { createRedirectRepository } = require('../../src/repositories/redirect-repository');
const { createSiteRepository } = require('../../src/repositories/site-repository');
const { createSeededAppPaths } = require('./test-paths');

function writeUpload(uploadRoot, filename, contents = filename) {
  const storagePath = path.join(uploadRoot, filename);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, contents);
  return storagePath;
}

function seedRepresentativePublicContent({ catalogRepository, mediaRepository, redirectRepository, siteRepository, paths }) {
  const dmaBrochure = mediaRepository.createAsset({
    assetKey: 'dma-lite-brochure',
    siteKey: 'dma',
    filename: 'dma-lite-brochure.pdf',
    mimeType: 'application/pdf',
    storagePath: writeUpload(paths.uploadRoot, 'dma-lite-brochure.pdf', 'DMA brochure'),
    altText: 'DMA Lite brochure',
  });
  const dmaProductAttachment = mediaRepository.createAsset({
    assetKey: 'dma-lite-specs',
    siteKey: 'dma',
    filename: 'dma-lite-specs.pdf',
    mimeType: 'application/pdf',
    storagePath: writeUpload(paths.uploadRoot, 'dma-lite-specs.pdf', 'DMA specs'),
    altText: 'DMA Lite specs',
  });
  const dmaSolutionAttachment = mediaRepository.createAsset({
    assetKey: 'dma-solution-pack',
    siteKey: 'dma',
    filename: 'dma-solution-pack.pdf',
    mimeType: 'application/pdf',
    storagePath: writeUpload(paths.uploadRoot, 'dma-solution-pack.pdf', 'DMA solution'),
    altText: 'DMA solution pack',
  });
  const dmaPageAttachment = mediaRepository.createAsset({
    assetKey: 'dma-history-pack',
    siteKey: 'dma',
    filename: 'dma-history-pack.pdf',
    mimeType: 'application/pdf',
    storagePath: writeUpload(paths.uploadRoot, 'dma-history-pack.pdf', 'DMA history'),
    altText: 'DMA history pack',
  });
  const dmaNewsHero = mediaRepository.createAsset({
    assetKey: 'dma-news-hero',
    siteKey: 'dma',
    filename: 'dma-news-hero.png',
    mimeType: 'image/png',
    storagePath: writeUpload(paths.uploadRoot, 'dma-news-hero.png', 'png'),
    altText: 'DMA news hero',
  });
  const bigfootAttachment = mediaRepository.createAsset({
    assetKey: 'bigfoot-b8erp-pack',
    siteKey: 'bigfoot',
    filename: 'bigfoot-b8erp-pack.pdf',
    mimeType: 'application/pdf',
    storagePath: writeUpload(paths.uploadRoot, 'bigfoot-b8erp-pack.pdf', 'Bigfoot pack'),
    altText: 'B8ERP pack',
  });

  catalogRepository.createProduct({
    siteKey: 'dma',
    slug: 'dma-lite',
    title: 'DMA Lite 夜间监测平台',
    summary: '面向供水企业的漏损监测产品。',
    bodyHtml: '<p>帮助水司快速定位漏损风险并形成闭环治理。</p>',
    brochureMediaId: dmaBrochure.id,
    attachmentMediaId: dmaProductAttachment.id,
    seoTitle: 'DMA Lite 产品',
    publishState: 'published',
    sortOrder: 1,
  });
  catalogRepository.createProduct({
    siteKey: 'dma',
    slug: 'draft-sensor',
    title: '草稿产品',
    summary: '不应在前台出现。',
    publishState: 'draft',
    sortOrder: 9,
  });
  catalogRepository.createProduct({
    siteKey: 'bigfoot',
    slug: 'b8erp',
    title: 'B8ERP 营收管理系统',
    summary: '覆盖收费、抄表与营收稽核。',
    bodyHtml: '<p>服务自来水企业全流程运营管理。</p>',
    attachmentMediaId: bigfootAttachment.id,
    publishState: 'published',
    sortOrder: 1,
  });

  catalogRepository.createSolution({
    siteKey: 'dma',
    slug: 'district-metering',
    title: '分区计量解决方案',
    summary: '支撑 DMA 分区治理与夜间最小流量分析。',
    bodyHtml: '<p>提供从采集、分析到闭环处置的完整流程。</p>',
    attachmentMediaId: dmaSolutionAttachment.id,
    publishState: 'published',
    sortOrder: 1,
  });

  catalogRepository.createNewsArticle({
    siteKey: 'dma',
    slug: 'water-loss-summit',
    title: '漏损治理研讨会发布新方案',
    summary: '聚焦智慧水务与精细化降差。',
    bodyHtml: '<p>研讨会现场展示了 DMA Lite 的最新实践成果。</p>',
    heroMediaId: dmaNewsHero.id,
    publishState: 'published',
    sortOrder: 1,
  });

  catalogRepository.createCaseStudy({
    siteKey: 'dma',
    slug: 'shenzhen-utility',
    title: '深圳水司漏损治理案例',
    summary: '通过分区治理实现产销差持续下降。',
    bodyHtml: '<p>项目在六个月内完成多轮夜间最小流量分析与整改。</p>',
    attachmentMediaId: dmaSolutionAttachment.id,
    publishState: 'published',
    sortOrder: 1,
  });

  catalogRepository.createPage({
    siteKey: 'dma',
    path: '/about',
    title: '关于智灵科技',
    summary: '聚焦智慧供水数字化。',
    bodyHtml: '<p>智灵科技服务于城市供水与工业园区客户。</p>',
    publishState: 'published',
    sortOrder: 1,
  });
  catalogRepository.createPage({
    siteKey: 'dma',
    path: '/about/history',
    title: '发展历程',
    summary: '从项目试点到规模化交付。',
    bodyHtml: '<p>团队从夜间最小流量项目起步，逐步扩展到全域漏损治理。</p>',
    attachmentMediaId: dmaPageAttachment.id,
    publishState: 'published',
    sortOrder: 2,
  });
  catalogRepository.createPage({
    siteKey: 'dma',
    path: '/products',
    title: '不应覆盖产品列表',
    summary: '这个页面用于验证路由顺序。',
    bodyHtml: '<p>如果出现，说明泛页面路由顺序错误。</p>',
    publishState: 'published',
    sortOrder: 3,
  });
  catalogRepository.createPage({
    siteKey: 'dma',
    path: '/drafts/internal-roadmap',
    title: '内部路线图',
    summary: '不应公开。',
    bodyHtml: '<p>这是草稿页面。</p>',
    publishState: 'draft',
    sortOrder: 4,
  });
  catalogRepository.createPage({
    siteKey: 'bigfoot',
    path: '/about',
    title: '关于同创科技',
    summary: '长期深耕智慧水务行业。',
    bodyHtml: '<p>同创科技专注供水信息化与收费系统建设。</p>',
    publishState: 'published',
    sortOrder: 1,
  });

  siteRepository.replaceNavigation('dma', [
    { key: 'home', label: '首页', href: '/', position: 0 },
    { key: 'about', label: '关于我们', href: '/about', position: 1 },
    { key: 'products', label: '产品中心', href: '/products', position: 2 },
    { key: 'solutions', label: '解决方案', href: '/solutions', position: 3 },
    { key: 'news', label: '新闻中心', href: '/news', position: 4 },
    { key: 'cases', label: '客户案例', href: '/cases', position: 5 },
    { key: 'contact', label: '联系我们', href: '/contact', position: 6 },
  ]);
  siteRepository.replaceNavigation('bigfoot', [
    { key: 'home', label: '首页', href: '/', position: 0 },
    { key: 'about', label: '关于同创', href: '/about', position: 1 },
    { key: 'products', label: '收费系统', href: '/products', position: 2 },
    { key: 'solutions', label: '手机抄表', href: '/solutions', position: 3 },
    { key: 'news', label: '新闻动态', href: '/news', position: 4 },
    { key: 'contact', label: '联系我们', href: '/contact', position: 5 },
  ]);

  redirectRepository.createRule({
    siteKey: 'dma',
    sourcePath: '/nd.jsp',
    sourceQuery: 'id=111',
    targetPath: '/news/water-loss-summit',
    statusCode: 301,
  });
  redirectRepository.createRule({
    siteKey: 'dma',
    sourcePath: '/old-contact',
    sourceQuery: '',
    targetPath: '/contact',
    statusCode: 302,
  });
  catalogRepository.createPage({
    siteKey: 'dma',
    path: '/nd.jsp',
    title: '不应在重定向前显示',
    summary: '用于验证重定向优先级。',
    bodyHtml: '<p>这段内容不应该被用户看见。</p>',
    publishState: 'published',
    sortOrder: 99,
  });
}

function withPublicApp(t, prefix = 'b8-public-', seed = seedRepresentativePublicContent) {
  const paths = createSeededAppPaths(prefix);
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const db = createDatabase(paths.databasePath);
  const repositories = {
    db,
    siteRepository: createSiteRepository(db),
    catalogRepository: createCatalogRepository(db),
    mediaRepository: createMediaRepository(db),
    redirectRepository: createRedirectRepository(db),
    paths,
  };

  seed(repositories);
  db.close();

  const app = createApp({
    databasePath: paths.databasePath,
    sessionSecret: 'task5-public-secret',
    uploadRoot: paths.uploadRoot,
  });

  return {
    app,
    paths,
  };
}

module.exports = {
  seedRepresentativePublicContent,
  writeUpload,
  withPublicApp,
};
