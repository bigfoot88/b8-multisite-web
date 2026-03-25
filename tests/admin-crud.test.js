const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createDatabase } = require('../src/lib/db');
const { loginAsAdmin } = require('./helpers/login-as-admin');
const { createSeededAppPaths } = require('./helpers/test-paths');

function withApp(t, prefix) {
  const paths = createSeededAppPaths(prefix);
  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  return {
    app,
    agent: request.agent(app),
    db: createDatabase(paths.databasePath),
  };
}

test('admin can create and update a product from the Chinese form', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-product-');
  t.after(() => db.close());

  const loginResponse = await loginAsAdmin(agent);
  assert.equal(loginResponse.status, 302);

  const createResponse = await agent
    .post('/admin/dma/products')
    .type('form')
    .send({
      slug: 'dma-lite-cn',
      title: 'DMA 中文版',
      summary: '中文摘要',
      bodyHtml: '<p>中文内容</p>',
      seoTitle: 'DMA SEO',
      seoDescription: 'DMA SEO 描述',
      sortOrder: '5',
      publishState: 'published',
    });

  assert.equal(createResponse.status, 302);
  assert.equal(createResponse.headers.location, '/admin/dma/products');

  const created = db.prepare('SELECT * FROM products WHERE site_key = ? AND slug = ?').get('dma', 'dma-lite-cn');
  assert.equal(created.title, 'DMA 中文版');
  assert.equal(created.publish_state, 'published');

  const updateResponse = await agent
    .post(`/admin/dma/products/${created.id}`)
    .type('form')
    .send({
      slug: 'dma-lite-cn',
      title: 'DMA 中文版升级',
      summary: '更新后的摘要',
      bodyHtml: '<p>更新后的中文内容</p>',
      seoTitle: 'DMA SEO 更新',
      seoDescription: 'DMA SEO 描述更新',
      sortOrder: '3',
      publishState: 'draft',
    });

  assert.equal(updateResponse.status, 302);
  assert.equal(updateResponse.headers.location, '/admin/dma/products');

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(created.id);
  assert.equal(updated.title, 'DMA 中文版升级');
  assert.equal(updated.publish_state, 'draft');
  assert.equal(updated.sort_order, 3);

  const listResponse = await agent.get('/admin/dma/products');
  assert.equal(listResponse.status, 200);
  assert.match(listResponse.text, /DMA 中文版升级/);
});

test('homepage sections respect publish state by host', async (t) => {
  const { app, agent } = withApp(t, 'b8-admin-sections-');

  await loginAsAdmin(agent);

  const unpublishResponse = await agent
    .post('/admin/dma/sections/hero')
    .type('form')
    .send({
      sectionKey: 'hero',
      heading: '隐藏的 DMA Hero',
      subheading: '不应显示',
      body: '隐藏内容',
      sortOrder: '0',
      isPublished: '',
      configJson: '{"ctaLabel":"预约演示","ctaHref":"/contact"}',
    });

  assert.equal(unpublishResponse.status, 302);

  const hiddenResponse = await request(app)
    .get('/')
    .set('host', 'dma.b8water.com');
  assert.equal(hiddenResponse.status, 200);
  assert.doesNotMatch(hiddenResponse.text, /隐藏的 DMA Hero/);

  const bigfootResponse = await request(app)
    .get('/')
    .set('host', 'www.chinabigfoot.com');
  assert.match(bigfootResponse.text, /选择B8ERP/);
});

test('homepage sections list exposes removal and deletes a section record', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-sections-delete-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  await agent
    .post('/admin/dma/sections')
    .type('form')
    .send({
      sectionKey: 'promo-strip',
      heading: '限时活动',
      subheading: '仅限本周',
      body: '删除前可见',
      sortOrder: '9',
      isPublished: '1',
      configJson: '{"ctaLabel":"立即咨询"}',
    });

  const listResponse = await agent.get('/admin/dma/sections');
  assert.equal(listResponse.status, 200);
  assert.match(listResponse.text, /\/admin\/dma\/sections\/hero\/delete/);
  assert.match(listResponse.text, /\/admin\/dma\/sections\/promo-strip\/delete/);

  const deleteResponse = await agent
    .post('/admin/dma/sections/promo-strip/delete')
    .type('form')
    .send({});

  assert.equal(deleteResponse.status, 302);
  assert.equal(deleteResponse.headers.location, '/admin/dma/sections');

  const deleted = db.prepare('SELECT * FROM site_sections WHERE site_key = ? AND section_key = ?').get('dma', 'promo-strip');
  assert.equal(deleted, undefined);

  const updatedListResponse = await agent.get('/admin/dma/sections');
  assert.equal(updatedListResponse.status, 200);
  assert.doesNotMatch(updatedListResponse.text, /promo-strip/);
});

test('site settings form updates contact and seo fields', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-settings-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: '智灵科技升级版',
      domain: 'dma-new.b8water.com',
      seoTitle: '智灵科技 SEO',
      seoDescription: '新的 SEO 描述',
      contactEmail: 'service@dma.example.com',
      contactPhone: '0755-12345678',
      contactAddress: '深圳市南山区科技园 88 号',
    });

  assert.equal(response.status, 302);
  const row = db.prepare('SELECT * FROM site_settings WHERE site_key = ?').get('dma');
  assert.equal(row.brand_name, '智灵科技升级版');
  assert.equal(row.contact_email, 'service@dma.example.com');
  assert.equal(row.seo_title, '智灵科技 SEO');

  const page = await agent.get('/admin/dma/settings');
  assert.match(page.text, /service@dma\.example\.com/);
  assert.match(page.text, /智灵科技 SEO/);
});

test('site settings reject duplicate domains across sites', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-duplicate-domain-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const originalBigfoot = db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('bigfoot').domain;
  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: '智灵科技',
      domain: originalBigfoot,
      seoTitle: '重复域名测试',
      seoDescription: '不应保存',
      contactEmail: 'duplicate@dma.example.com',
      contactPhone: '0755-00000000',
      contactAddress: '测试地址',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /域名已被其他站点使用/);

  const dmaRow = db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('dma');
  assert.notEqual(dmaRow.domain, originalBigfoot);
});

test('site settings keep the Chinese duplicate-domain error when storage rejects a concurrent conflict', async (t) => {
  const { agent, db, app } = withApp(t, 'b8-admin-storage-duplicate-domain-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const siteRepository = app.locals.siteRepository;
  const originalLookup = siteRepository.getSiteSettingsByDomain.bind(siteRepository);
  let conflictInjected = false;

  siteRepository.getSiteSettingsByDomain = (domain) => {
    const existing = originalLookup(domain);

    if (!conflictInjected && domain === 'foo.local' && !existing) {
      db.prepare('UPDATE site_settings SET domain = ? WHERE site_key = ?').run('foo.local', 'bigfoot');
      conflictInjected = true;
    }

    return existing;
  };

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: '智灵科技',
      domain: 'Foo.Local',
      seoTitle: '并发冲突测试',
      seoDescription: '应显示友好错误',
      contactEmail: 'race@dma.example.com',
      contactPhone: '0755-22222222',
      contactAddress: 'DMA 地址',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /域名已被其他站点使用，请更换后重试。/);
  assert.equal(db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('dma').domain, 'dma.b8water.com');
});

test('site settings normalize mixed-case domains and resolve requests by lowercase host', async (t) => {
  const { app, agent, db } = withApp(t, 'b8-admin-domain-normalize-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: '智灵科技',
      domain: 'Foo.Local',
      seoTitle: 'DMA Mixed Case SEO',
      seoDescription: '大小写域名测试',
      contactEmail: 'mixed@dma.example.com',
      contactPhone: '0755-88888888',
      contactAddress: '深圳测试地址',
    });

  assert.equal(response.status, 302);

  const dmaRow = db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('dma');
  assert.equal(dmaRow.domain, 'foo.local');

  const homepageResponse = await request(app)
    .get('/')
    .set('host', 'foo.local');
  assert.equal(homepageResponse.status, 200);
  assert.match(homepageResponse.text, /DMA Mixed Case SEO/);
});

test('site settings reject case-variant duplicate domains across sites', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-case-duplicate-domain-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const dmaSaveResponse = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: '智灵科技',
      domain: 'Foo.Local',
      seoTitle: 'DMA 大小写域名',
      seoDescription: 'DMA 先保存混合大小写域名',
      contactEmail: 'case@dma.example.com',
      contactPhone: '0755-11111111',
      contactAddress: 'DMA 地址',
    });
  assert.equal(dmaSaveResponse.status, 302);

  const originalBigfoot = db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('bigfoot').domain;
  const duplicateResponse = await agent
    .post('/admin/bigfoot/settings')
    .type('form')
    .send({
      brandName: '中山市同创科技发展有限公司',
      domain: 'foo.local',
      seoTitle: 'Bigfoot 大小写冲突',
      seoDescription: '不应保存',
      contactEmail: 'case@bigfoot.example.com',
      contactPhone: '400-660-3328',
      contactAddress: 'Bigfoot 地址',
    });

  assert.equal(duplicateResponse.status, 400);
  assert.match(duplicateResponse.text, /域名已被其他站点使用，请更换后重试。/);
  assert.equal(
    db.prepare('SELECT domain FROM site_settings WHERE site_key = ?').get('bigfoot').domain,
    originalBigfoot,
  );
});

test('site CRUD routes keep records isolated per domain', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-cross-site-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  await agent.post('/admin/dma/products').type('form').send({
    slug: 'dma-only',
    title: 'DMA 独享产品',
    publishState: 'published',
  });
  await agent.post('/admin/bigfoot/products').type('form').send({
    slug: 'bigfoot-only',
    title: '同创独享产品',
    publishState: 'published',
  });

  const dmaList = await agent.get('/admin/dma/products');
  const bigfootList = await agent.get('/admin/bigfoot/products');

  assert.match(dmaList.text, /DMA 独享产品/);
  assert.doesNotMatch(dmaList.text, /同创独享产品/);
  assert.match(bigfootList.text, /同创独享产品/);
  assert.doesNotMatch(bigfootList.text, /DMA 独享产品/);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products WHERE site_key = ?').get('dma').count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products WHERE site_key = ?').get('bigfoot').count, 1);
});

test('product lists support soft delete, publish-state filter, and sorting', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-filters-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  await agent.post('/admin/dma/products').type('form').send({
    slug: 'draft-item',
    title: '草稿产品',
    sortOrder: '20',
    publishState: 'draft',
  });
  await agent.post('/admin/dma/products').type('form').send({
    slug: 'published-item',
    title: '已发布产品',
    sortOrder: '5',
    publishState: 'published',
  });

  const published = db.prepare('SELECT id FROM products WHERE slug = ?').get('published-item');
  const softDeleteResponse = await agent.post(`/admin/dma/products/${published.id}/delete`).type('form').send({});
  assert.equal(softDeleteResponse.status, 302);

  const defaultList = await agent.get('/admin/dma/products');
  assert.match(defaultList.text, /草稿产品/);
  assert.doesNotMatch(defaultList.text, /已发布产品/);

  const allList = await agent.get('/admin/dma/products?status=all&sort=title_desc');
  assert.match(allList.text, /已删除/);
  assert.ok(allList.text.indexOf('草稿产品') > allList.text.indexOf('已发布产品'));

  const draftOnly = await agent.get('/admin/dma/products?publishState=draft');
  assert.match(draftOnly.text, /草稿产品/);
  assert.doesNotMatch(draftOnly.text, /已发布产品/);
});

test('product form reports duplicate slugs as a recoverable admin conflict', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-duplicate-product-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const firstResponse = await agent
    .post('/admin/dma/products')
    .type('form')
    .send({
      slug: 'duplicate-product',
      title: '第一次创建',
      publishState: 'published',
    });
  assert.equal(firstResponse.status, 302);

  const duplicateResponse = await agent
    .post('/admin/dma/products')
    .type('form')
    .send({
      slug: 'duplicate-product',
      title: '重复创建',
      publishState: 'draft',
    });

  assert.equal(duplicateResponse.status, 409);
  assert.match(duplicateResponse.text, /Slug 已存在，请更换后重试。/);
  assert.match(duplicateResponse.text, /重复创建/);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM products WHERE site_key = ? AND slug = ?').get('dma', 'duplicate-product').count,
    1,
  );
});

test('page form reports duplicate paths as a recoverable admin conflict', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-duplicate-page-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const firstResponse = await agent
    .post('/admin/dma/pages')
    .type('form')
    .send({
      path: '/duplicate-page',
      title: '首次页面',
      publishState: 'published',
    });
  assert.equal(firstResponse.status, 302);

  const duplicateResponse = await agent
    .post('/admin/dma/pages')
    .type('form')
    .send({
      path: '/duplicate-page',
      title: '重复页面',
      publishState: 'draft',
    });

  assert.equal(duplicateResponse.status, 409);
  assert.match(duplicateResponse.text, /页面路径已存在，请更换后重试。/);
  assert.match(duplicateResponse.text, /重复页面/);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM pages WHERE site_key = ? AND path = ?').get('dma', '/duplicate-page').count,
    1,
  );
});

test('page form rejects cross-site parent references with a recoverable error', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-cross-site-parent-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const parentResponse = await agent
    .post('/admin/dma/pages')
    .type('form')
    .send({
      path: '/dma-parent',
      title: 'DMA 上级页面',
      publishState: 'published',
    });
  assert.equal(parentResponse.status, 302);

  const dmaParent = db.prepare('SELECT id FROM pages WHERE site_key = ? AND path = ?').get('dma', '/dma-parent');
  const crossSiteResponse = await agent
    .post('/admin/bigfoot/pages')
    .type('form')
    .send({
      parentId: String(dmaParent.id),
      path: '/bigfoot-child',
      title: '错误站点页面',
      publishState: 'draft',
    });

  assert.equal(crossSiteResponse.status, 400);
  assert.match(crossSiteResponse.text, /上级页面必须属于当前站点。/);
  assert.match(crossSiteResponse.text, /错误站点页面/);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM pages WHERE site_key = ? AND path = ?').get('bigfoot', '/bigfoot-child').count,
    0,
  );
});

test('navigation form rejects cross-site parent references with a recoverable error', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-cross-site-navigation-parent-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const parentResponse = await agent
    .post('/admin/dma/navigation')
    .type('form')
    .send({
      label: 'DMA 上级导航',
      href: '/dma-parent',
      position: '10',
      kind: 'link',
      isVisible: '1',
    });
  assert.equal(parentResponse.status, 302);

  const dmaParent = db.prepare('SELECT id FROM navigation_items WHERE site_key = ? AND label = ?').get('dma', 'DMA 上级导航');
  const crossSiteResponse = await agent
    .post('/admin/bigfoot/navigation')
    .type('form')
    .send({
      label: '错误站点导航',
      href: '/wrong-parent',
      parentId: String(dmaParent.id),
      position: '11',
      kind: 'link',
      isVisible: '1',
    });

  assert.equal(crossSiteResponse.status, 400);
  assert.match(crossSiteResponse.text, /父级导航必须属于当前站点。/);
  assert.match(crossSiteResponse.text, /错误站点导航/);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM navigation_items WHERE site_key = ? AND label = ?').get('bigfoot', '错误站点导航').count,
    0,
  );
});

test('navigation form rejects self-parent updates with a recoverable error', async (t) => {
  const { agent, db } = withApp(t, 'b8-admin-self-parent-navigation-');
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const createResponse = await agent
    .post('/admin/dma/navigation')
    .type('form')
    .send({
      label: '可编辑导航',
      href: '/editable-nav',
      position: '12',
      kind: 'link',
      isVisible: '1',
    });
  assert.equal(createResponse.status, 302);

  const existingItem = db.prepare('SELECT id, parent_id FROM navigation_items WHERE site_key = ? AND label = ?').get('dma', '可编辑导航');
  const updateResponse = await agent
    .post(`/admin/dma/navigation`)
    .type('form')
    .send({
      id: String(existingItem.id),
      label: '可编辑导航',
      href: '/editable-nav',
      parentId: String(existingItem.id),
      position: '12',
      kind: 'link',
      isVisible: '1',
    });

  assert.equal(updateResponse.status, 400);
  assert.match(updateResponse.text, /导航项不能选择自身作为父级。/);
  assert.match(updateResponse.text, /可编辑导航/);
  assert.equal(
    db.prepare('SELECT parent_id FROM navigation_items WHERE id = ?').get(existingItem.id).parent_id,
    existingItem.parent_id,
  );
});
