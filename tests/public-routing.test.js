const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { withPublicApp } = require('./helpers/public-fixtures');

test('public routes render host-specific site pages and collection detail pages', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-routes-');

  const dmaHome = await request(app)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(dmaHome.status, 200);
  assert.match(dmaHome.text, /DMA Lite · 夜间最小流量监测方案/);
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

  const notFound = await request(app)
    .get('/missing-page')
    .set('host', 'dma.b8water.com');
  assert.equal(notFound.status, 404);
  assert.match(notFound.text, /未找到相关页面/);
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

test('public pages render brochure and download links from managed local uploads', async (t) => {
  const { app } = withPublicApp(t, 'b8-public-downloads-');

  const productDetail = await request(app)
    .get('/products/dma-lite')
    .set('host', 'dma.b8water.com');
  assert.equal(productDetail.status, 200);
  assert.match(productDetail.text, /href="\/uploads\/dma-lite-brochure\.pdf"/);
  assert.match(productDetail.text, /href="\/uploads\/dma-lite-specs\.pdf"/);

  const pageDetail = await request(app)
    .get('/about/history')
    .set('host', 'dma.b8water.com');
  assert.equal(pageDetail.status, 200);
  assert.match(pageDetail.text, /href="\/uploads\/dma-history-pack\.pdf"/);

  const solutionDetail = await request(app)
    .get('/solutions/district-metering')
    .set('host', 'dma.b8water.com');
  assert.equal(solutionDetail.status, 200);
  assert.match(solutionDetail.text, /href="\/uploads\/dma-solution-pack\.pdf"/);
});
