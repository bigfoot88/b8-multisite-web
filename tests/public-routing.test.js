const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { promisify } = require('node:util');
const express = require('express');
const request = require('supertest');
const ejs = require('ejs');

const { createPublicRouter } = require('../src/routes/public');
const {
  seedRepresentativePublicContent,
  seedRepresentativePublicContentWithEmptyFeatureImage,
  seedRepresentativePublicContentWithMissingHeroCtaHref,
  seedRepresentativePublicContentWithNoHomeImages,
  seedRepresentativePublicContentWithSingleHomeImage,
  withPublicApp,
  writeUpload,
} = require('./helpers/public-fixtures');

const renderFile = promisify(ejs.renderFile);

test('public home render locals use the hydrated site returned by the public site service', async () => {
  const rawSite = {
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.local',
    seoTitle: 'DMA',
    seoDescription: 'DMA homepage',
  };
  const hydratedSite = {
    ...rawSite,
    homeHeroSlides: [{ id: 101, filename: 'dma-home-primary.png' }],
    homeFeatureAsset: { id: 202, filename: 'dma-home-feature.png' },
  };
  const siteRepository = {
    getSiteSettingsByDomain(domain) {
      return domain === 'dma.local' ? rawSite : null;
    },
    listSiteSettings() {
      return [rawSite];
    },
  };
  const publicSiteService = {
    findRedirect() {
      return null;
    },
    getSiteFrame() {
      return {
        site: hydratedSite,
        navigation: [],
        heroSection: null,
        publishedSections: [],
      };
    },
    getHomePage() {
      return {
        site: hydratedSite,
        heroSection: null,
        featuredProducts: [],
        featuredSolutions: [],
        latestNews: [],
        featuredCases: [],
      };
    },
  };
  const app = express();

  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(200).json({ view, locals });
    next();
  });
  app.use('/', createPublicRouter({ siteRepository, publicSiteService }));

  const response = await request(app)
    .get('/')
    .set('host', 'dma.local');

  assert.equal(response.status, 200);
  assert.equal(response.body.view, 'public/home');
  assert.deepEqual(response.body.locals.site.homeHeroSlides, hydratedSite.homeHeroSlides);
  assert.deepEqual(response.body.locals.site.homeFeatureAsset, hydratedSite.homeFeatureAsset);
});

test('site-scoped not-found renders use the hydrated site returned by the public site service', async () => {
  const rawSite = {
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.local',
    seoTitle: 'DMA',
    seoDescription: 'DMA homepage',
  };
  const hydratedSite = {
    ...rawSite,
    homeHeroSlides: [{ id: 101, filename: 'dma-home-primary.png' }],
    homeFeatureAsset: { id: 202, filename: 'dma-home-feature.png' },
  };
  const siteRepository = {
    getSiteSettingsByDomain(domain) {
      return domain === 'dma.local' ? rawSite : null;
    },
    listSiteSettings() {
      return [rawSite];
    },
  };
  const publicSiteService = {
    findRedirect() {
      return null;
    },
    getSiteFrame() {
      return {
        site: hydratedSite,
        navigation: [],
        heroSection: null,
        publishedSections: [],
      };
    },
    getGenericPage() {
      return null;
    },
  };
  const app = express();

  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, locals });
    next();
  });
  app.use('/', createPublicRouter({ siteRepository, publicSiteService }));

  const response = await request(app)
    .get('/missing-page')
    .set('host', 'dma.local');

  assert.equal(response.status, 404);
  assert.equal(response.body.view, 'public/not-found');
  assert.deepEqual(response.body.locals.site.homeHeroSlides, hydratedSite.homeHeroSlides);
  assert.deepEqual(response.body.locals.site.homeFeatureAsset, hydratedSite.homeFeatureAsset);
});

test('public routes render host-specific site pages and collection detail pages', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-routes-');

  const dmaHome = await request(app)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(dmaHome.status, 200);
  assert.match(dmaHome.text, /DMA Lite · 夜间最小流量\+分区漏损监测方案/);
  assert.match(dmaHome.text, /DMA Lite 夜间监测平台/);

  const products = await request(app)
    .get('/products')
    .set('host', 'dma.b8water.com');
  assert.equal(products.status, 200);
  assert.match(products.text, /DMA Lite 夜间监测平台/);
  assert.doesNotMatch(products.text, /草稿产品/);

  const productDetail = await request(app)
    .get('/products/dma-lite')
    .set('host', 'dma.b8water.com');
  assert.equal(productDetail.status, 200);
  assert.match(productDetail.text, /帮助水司快速定位漏损风险并形成闭环治理/);

  const solutions = await request(app)
    .get('/solutions')
    .set('host', 'dma.b8water.com');
  assert.equal(solutions.status, 200);
  assert.match(solutions.text, /分区计量解决方案/);

  const solutionDetail = await request(app)
    .get('/solutions/district-metering')
    .set('host', 'dma.b8water.com');
  assert.equal(solutionDetail.status, 200);
  assert.match(solutionDetail.text, /完整流程/);

  const newsIndex = await request(app)
    .get('/news')
    .set('host', 'dma.b8water.com');
  assert.equal(newsIndex.status, 200);
  assert.match(newsIndex.text, /漏损治理研讨会发布新方案/);

  const newsDetail = await request(app)
    .get('/news/water-loss-summit')
    .set('host', 'dma.b8water.com');
  assert.equal(newsDetail.status, 200);
  assert.match(newsDetail.text, /最新实践成果/);

  const casesIndex = await request(app)
    .get('/cases')
    .set('host', 'dma.b8water.com');
  assert.equal(casesIndex.status, 200);
  assert.match(casesIndex.text, /深圳水司漏损治理案例/);

  const caseDetail = await request(app)
    .get('/cases/shenzhen-utility')
    .set('host', 'dma.b8water.com');
  assert.equal(caseDetail.status, 200);
  assert.match(caseDetail.text, /六个月内完成多轮夜间最小流量分析与整改/);

  const aboutPage = await request(app)
    .get('/about')
    .set('host', 'dma.b8water.com');
  assert.equal(aboutPage.status, 200);
  assert.match(aboutPage.text, /关于智灵科技/);

  const contactPage = await request(app)
    .get('/contact')
    .set('host', 'www.chinabigfoot.com');
  assert.equal(contactPage.status, 200);
  assert.match(contactPage.text, /中山市同创科技发展有限公司/);
  assert.match(contactPage.text, /400-660-3328/);

  const bigfootHome = await request(app)
    .get('/')
    .set('host', 'www.chinabigfoot.com');
  assert.equal(bigfootHome.status, 200);
  assert.match(bigfootHome.text, /选择B8ERP，开启智能水务新纪元/);
  assert.doesNotMatch(bigfootHome.text, /home-case-list/);

  const notFound = await request(app)
    .get('/missing-page')
    .set('host', 'dma.b8water.com');
  assert.equal(notFound.status, 404);
  assert.match(notFound.text, /未找到相关页面/);
});

test('public homepage renders the redesigned media composition and configured homepage assets', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-home-default-');
  const { app: singleImageApp } = withPublicApp(
    t,
    'b8-public-home-single-',
    seedRepresentativePublicContentWithSingleHomeImage,
  );
  const { app: emptyFeatureApp } = withPublicApp(
    t,
    'b8-public-home-empty-feature-',
    seedRepresentativePublicContentWithEmptyFeatureImage,
  );
  const { app: noImagesApp } = withPublicApp(
    t,
    'b8-public-home-no-images-',
    seedRepresentativePublicContentWithNoHomeImages,
  );
  const { app: missingHeroCtaHrefApp } = withPublicApp(
    t,
    'b8-public-home-missing-hero-cta-',
    seedRepresentativePublicContentWithMissingHeroCtaHref,
  );

  const homeResponse = await request(app)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(homeResponse.status, 200);
  const homeHtml = homeResponse.text;
  assert.match(homeHtml, /home-media-band/);
  assert.match(homeHtml, /home-case-list/);
  assert.match(homeHtml, /\/media\/dma-home-primary\.png/);
  assert.match(homeHtml, /\/media\/dma-home-secondary\.png/);
  assert.match(homeHtml, /\/media\/dma-home-feature\.png/);
  assert.match(homeHtml, /DMA 首页全宽图 1/);
  assert.match(homeHtml, /DMA 首页全宽图 2/);
  assert.match(homeHtml, /DMA 首页解决方案主图/);
  assert.match(homeHtml, /home-feature-media/);
  assert.match(homeHtml, /hero-panel hero-panel--text-only/);
  assert.match(homeHtml, /预约演示/);
  assert.match(homeHtml, /href="\/contact"/);
  assert.doesNotMatch(homeHtml, /<p class="eyebrow">产品矩阵<\/p>/);
  assert.doesNotMatch(homeHtml, /card__eyebrow/);
  assert.doesNotMatch(homeHtml, /footer-cta/);

  const singleImageHome = await request(singleImageApp)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(singleImageHome.status, 200);
  const singleImageHomeHtml = singleImageHome.text;
  assert.match(singleImageHomeHtml, /\/media\/dma-home-primary\.png/);
  assert.doesNotMatch(singleImageHomeHtml, /dma-home-secondary\.png/);

  const emptyFeatureHome = await request(emptyFeatureApp)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(emptyFeatureHome.status, 200);
  const emptyFeatureHomeHtml = emptyFeatureHome.text;
  assert.match(emptyFeatureHomeHtml, /home-feature-media--empty/);
  assert.doesNotMatch(emptyFeatureHomeHtml, /dma-home-feature\.png/);

  const noImagesHome = await request(noImagesApp)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(noImagesHome.status, 200);
  assert.doesNotMatch(noImagesHome.text, /home-media-band/);

  const missingHeroCtaHrefHome = await request(missingHeroCtaHrefApp)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(missingHeroCtaHrefHome.status, 200);
  assert.match(missingHeroCtaHrefHome.text, /预约演示/);
  assert.match(missingHeroCtaHrefHome.text, /href="\/contact"/);
});

test('generic public pages support hierarchical paths, stay behind specific routes, and hide drafts', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-pages-');

  const nestedPage = await request(app)
    .get('/about/history')
    .set('host', 'dma.b8water.com');
  assert.equal(nestedPage.status, 200);
  assert.match(nestedPage.text, /发展历程/);
  assert.match(nestedPage.text, /逐步扩展到全域漏损治理/);

  const draftPage = await request(app)
    .get('/drafts/internal-roadmap')
    .set('host', 'dma.b8water.com');
  assert.equal(draftPage.status, 404);
  assert.match(draftPage.text, /未找到相关页面/);

  const hierarchicalFallback = await request(app)
    .get('/about/history/timeline')
    .set('host', 'dma.b8water.com');
  assert.equal(hierarchicalFallback.status, 200);
  assert.match(hierarchicalFallback.text, /发展历程/);
  assert.match(hierarchicalFallback.text, /逐步扩展到全域漏损治理/);

  const productsPage = await request(app)
    .get('/products')
    .set('host', 'dma.b8water.com');
  assert.equal(productsPage.status, 200);
  assert.match(productsPage.text, /DMA Lite 夜间监测平台/);
  assert.doesNotMatch(productsPage.text, /不应覆盖产品列表/);
});

test('generic public pages return 404 for unrelated missing paths even when a root page exists', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-root-page-', ({ catalogRepository, ...repositories }) => {
    seedRepresentativePublicContent({ catalogRepository, ...repositories });
    catalogRepository.createPage({
      siteKey: 'dma',
      path: '/',
      title: 'DMA Root Page',
      summary: 'Root page should not catch all missing URLs.',
      bodyHtml: '<p>Root page placeholder.</p>',
      publishState: 'published',
      sortOrder: 0,
    });
  });

  const missingPage = await request(app)
    .get('/totally/missing/path')
    .set('host', 'dma.b8water.com');
  assert.equal(missingPage.status, 404);
  assert.match(missingPage.text, /未找到相关页面/);
  assert.doesNotMatch(missingPage.text, /DMA Root Page/);

  const hierarchicalFallback = await request(app)
    .get('/about/history/timeline')
    .set('host', 'dma.b8water.com');
  assert.equal(hierarchicalFallback.status, 200);
  assert.match(hierarchicalFallback.text, /发展历程/);
});

test('public routes do not expose unrequested /case-studies aliases', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-cases-only-');

  const casesAliasIndex = await request(app)
    .get('/case-studies')
    .set('host', 'dma.b8water.com');
  assert.equal(casesAliasIndex.status, 404);
  assert.match(casesAliasIndex.text, /未找到相关页面/);

  const casesAliasDetail = await request(app)
    .get('/case-studies/shenzhen-utility')
    .set('host', 'dma.b8water.com');
  assert.equal(casesAliasDetail.status, 404);
  assert.match(casesAliasDetail.text, /未找到相关页面/);
});

test('public pages render brochure and download links from managed local uploads', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-downloads-');

  const productDetail = await request(app)
    .get('/products/dma-lite')
    .set('host', 'dma.b8water.com');
  assert.equal(productDetail.status, 200);
  assert.match(productDetail.text, /href="\/media\/dma-lite-brochure\.pdf"/);
  assert.match(productDetail.text, /href="\/media\/dma-lite-specs\.pdf"/);

  const pageDetail = await request(app)
    .get('/about/history')
    .set('host', 'dma.b8water.com');
  assert.equal(pageDetail.status, 200);
  assert.match(pageDetail.text, /href="\/media\/dma-history-pack\.pdf"/);

  const solutionDetail = await request(app)
    .get('/solutions/district-metering')
    .set('host', 'dma.b8water.com');
  assert.equal(solutionDetail.status, 200);
  assert.match(solutionDetail.text, /href="\/media\/dma-solution-pack\.pdf"/);
});

test('public pages sanitize stored rich html before rendering', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-sanitize-', ({ catalogRepository, mediaRepository, redirectRepository, siteRepository, paths }) => {
    seedRepresentativePublicContent({
      catalogRepository,
      mediaRepository,
      redirectRepository,
      siteRepository,
      paths,
    });

    catalogRepository.createProduct({
      siteKey: 'dma',
      slug: 'xss-widget',
      title: 'XSS Widget',
      summary: 'Rich HTML should be sanitized before public render.',
      bodyHtml: '<p onclick="alert(1)">保留段落</p><script>alert(1)</script><a href="javascript:alert(1)">危险链接</a><strong>安全加粗</strong>',
      publishState: 'published',
      sortOrder: 50,
    });
    catalogRepository.createPage({
      siteKey: 'dma',
      path: '/about/security',
      title: '安全页面',
      summary: '用于验证泛页面模板的富文本净化。',
      bodyHtml: '<div><p onmouseover="alert(1)">安全说明</p><script>alert(1)</script><a href="javascript:alert(1)">危险链接</a></div>',
      publishState: 'published',
      sortOrder: 51,
    });
  });

  const productDetail = await request(app)
    .get('/products/xss-widget')
    .set('host', 'dma.b8water.com');
  assert.equal(productDetail.status, 200);
  assert.match(productDetail.text, /<p>保留段落<\/p>/);
  assert.match(productDetail.text, /<strong>安全加粗<\/strong>/);
  assert.doesNotMatch(productDetail.text, /<div class="rich-text">[\s\S]*<script/i);
  assert.doesNotMatch(productDetail.text, /onclick=|onmouseover=/i);
  assert.doesNotMatch(productDetail.text, /javascript:/i);

  const genericPage = await request(app)
    .get('/about/security')
    .set('host', 'dma.b8water.com');
  assert.equal(genericPage.status, 200);
  assert.match(genericPage.text, /<p>安全说明<\/p>/);
  assert.doesNotMatch(genericPage.text, /<div class="rich-text">[\s\S]*<script/i);
  assert.doesNotMatch(genericPage.text, /onmouseover=/i);
  assert.doesNotMatch(genericPage.text, /javascript:/i);
});

test('public pages preserve editor images and paragraph classes after sanitization', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-rich-text-', ({ catalogRepository, paths, ...repositories }) => {
    seedRepresentativePublicContent({ catalogRepository, paths, ...repositories });

    catalogRepository.createProduct({
      siteKey: 'dma',
      slug: 'editor-rich-text',
      title: '编辑器富文本',
      summary: '验证图片和段落样式可以公开渲染。',
      bodyHtml: '<p style="font-family: Georgia, serif; font-size: 18px;">这是一段正文 <img src="/uploads/editor-inline.png" alt="DMA editor upload" /></p>',
      publishState: 'published',
      sortOrder: 60,
    });

    writeUpload(paths.uploadRoot, 'editor-inline.png', 'inline image content');
  });

  const productDetail = await request(app)
    .get('/products/editor-rich-text')
    .set('host', 'dma.b8water.com');
  assert.equal(productDetail.status, 200);
  assert.match(productDetail.text, /<p[^>]*style="(?=[^"]*font-family:)(?=[^"]*font-size:)[^"]*">/);
  assert.match(productDetail.text, /<img[^>]+src="\/uploads\/editor-inline\.png"[^>]+alt="DMA editor upload"/);
});

test('public asset downloads stay site-scoped, require published references, and support nested paths', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-assets-', ({ catalogRepository, mediaRepository, redirectRepository, siteRepository, paths }) => {
    seedRepresentativePublicContent({
      catalogRepository,
      mediaRepository,
      redirectRepository,
      siteRepository,
      paths,
    });

    const nestedAsset = mediaRepository.createAsset({
      assetKey: 'dma-nested-guide',
      siteKey: 'dma',
      filename: 'dma-guide.pdf',
      mimeType: 'application/pdf',
      storagePath: writeUpload(paths.uploadRoot, 'nested/guides/dma-guide.pdf', 'Nested DMA guide'),
    });
    const draftOnlyAsset = mediaRepository.createAsset({
      assetKey: 'dma-draft-only',
      siteKey: 'dma',
      filename: 'draft-only.pdf',
      mimeType: 'application/pdf',
      storagePath: writeUpload(paths.uploadRoot, 'drafts/internal/draft-only.pdf', 'Draft-only asset'),
    });

    catalogRepository.createPage({
      siteKey: 'dma',
      path: '/downloads/nested-guide',
      title: '嵌套下载',
      summary: '嵌套路径素材应保持相对路径公开地址。',
      bodyHtml: '<p>下载嵌套资料。</p>',
      attachmentMediaId: nestedAsset.id,
      publishState: 'published',
      sortOrder: 60,
    });
    catalogRepository.createPage({
      siteKey: 'dma',
      path: '/drafts/private-asset',
      title: '草稿资料页',
      summary: '草稿资产不应公开下载。',
      bodyHtml: '<p>草稿资料。</p>',
      attachmentMediaId: draftOnlyAsset.id,
      publishState: 'draft',
      sortOrder: 61,
    });
  });

  const nestedPage = await request(app)
    .get('/downloads/nested-guide')
    .set('host', 'dma.b8water.com');
  assert.equal(nestedPage.status, 200);
  assert.match(nestedPage.text, /href="\/media\/nested\/guides\/dma-guide\.pdf"/);

  const nestedDownload = await request(app)
    .get('/media/nested/guides/dma-guide.pdf')
    .set('host', 'dma.b8water.com');
  assert.equal(nestedDownload.status, 200);
  assert.equal(nestedDownload.body.toString(), 'Nested DMA guide');
  assert.equal(nestedDownload.headers['x-content-type-options'], 'nosniff');

  const crossHostDownload = await request(app)
    .get('/media/bigfoot-b8erp-pack.pdf')
    .set('host', 'dma.b8water.com');
  assert.equal(crossHostDownload.status, 404);

  const draftOnlyDownload = await request(app)
    .get('/media/drafts/internal/draft-only.pdf')
    .set('host', 'dma.b8water.com');
  assert.equal(draftOnlyDownload.status, 404);

  const wrongHostForNestedDownload = await request(app)
    .get('/media/nested/guides/dma-guide.pdf')
    .set('host', 'www.chinabigfoot.com');
  assert.equal(wrongHostForNestedDownload.status, 404);
});

test('news detail template falls back to article.heroAsset when top-level heroAsset is absent', async () => {
  const templatePath = path.join(__dirname, '../src/views/public/news-detail.ejs');
  const html = await renderFile(templatePath, {
    pageTitle: '新闻详情 · 智灵科技',
    pageDescription: '新闻摘要',
    site: {
      brandName: '智灵科技',
      seoDescription: '聚焦智慧水务',
      tagline: '夜间最小流量监测',
      contactPhone: '400-660-3328',
    },
    theme: {
      name: 'dma',
      label: 'DMA',
      accent: '智慧水务',
    },
    navigation: [],
    currentPath: '/news/example',
    sitePath: (target = '/') => target,
    article: {
      title: '模板回归测试',
      summary: '应该优先使用 article.heroAsset。',
      bodyHtml: '<p>正文内容正常渲染。</p>',
      createdAt: '2026-03-28T00:00:00.000Z',
      heroAsset: {
        publicUrl: '/media/template-cover.png',
        altText: '模板封面图',
      },
    },
  });

  assert.match(html, /template-cover\.png/);
  assert.match(html, /正文内容正常渲染/);
  assert.doesNotMatch(html, /ReferenceError/);
});
