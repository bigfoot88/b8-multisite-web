const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const { createApp } = require('../src/app');

function createTestPaths() {
  const tempDir = path.join(
    __dirname,
    '.scratch',
    `admin-adminjs-news-resource-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  fs.mkdirSync(tempDir, { recursive: true });

  return {
    tempDir,
    databasePath: path.join(tempDir, 'content.db'),
  };
}

async function closeApp(app) {
  if (typeof app?.close === 'function') {
    await app.close();
    return;
  }

  app?.locals?.db?.close?.();
}

function seedAdmin(app) {
  app.locals.adminRepository.createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });
}

test('authenticated AdminJS exposes a news article list page and create form', async (t) => {
  const paths = createTestPaths();
  const app = createApp({ databasePath: paths.databasePath });

  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  seedAdmin(app);

  const agent = request.agent(app);
  const loginResponse = await agent
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);
  assert.equal(loginResponse.headers.location, '/admin-next');

  const [listResponse, createResponse] = await Promise.all([
    agent.get('/admin-next/resources/news_articles/actions/list'),
    agent.get('/admin-next/resources/news_articles/actions/new'),
  ]);

  assert.equal(listResponse.status, 200);
  assert.match(listResponse.text, /"id":"news_articles"/);
  assert.equal(createResponse.status, 200);
  assert.match(createResponse.text, /site_key/i);
  assert.match(createResponse.text, /slug/i);
  assert.match(createResponse.text, /title/i);
  assert.match(createResponse.text, /publish_state/i);
});

test('authenticated AdminJS can create a news article record through the resource action', async (t) => {
  const paths = createTestPaths();
  const app = createApp({ databasePath: paths.databasePath });

  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  seedAdmin(app);
  app.locals.siteRepository.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.local',
  });

  const agent = request.agent(app);
  const loginResponse = await agent
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const createResponse = await agent
    .post('/admin-next/api/resources/news_articles/actions/new')
    .send({
      site_key: 'dma',
      slug: 'adminjs-created-news',
      title: 'AdminJS Created News',
      summary: 'Created from AdminJS',
      body_html: '<p>Hello from AdminJS</p>',
      seo_title: 'AdminJS SEO title',
      seo_description: 'AdminJS SEO description',
      sort_order: 10,
      publish_state: 'published',
    });

  assert.equal(createResponse.status, 200);
  assert.equal(createResponse.body.notice?.type, 'success');
  assert.equal(createResponse.body.record?.params?.site_key, 'dma');
  assert.equal(createResponse.body.record?.params?.slug, 'adminjs-created-news');
  assert.equal(createResponse.body.record?.params?.title, 'AdminJS Created News');
  assert.equal(createResponse.body.record?.params?.publish_state, 'published');
  assert.ok(createResponse.body.record?.params?.published_at);

  const row = app.locals.db
    .prepare(`
      SELECT site_key, slug, title, summary, body_html, seo_title, seo_description, sort_order, publish_state, published_at
      FROM news_articles
      WHERE slug = ?
    `)
    .get('adminjs-created-news');

  assert.deepEqual(
    {
      site_key: row.site_key,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body_html: row.body_html,
      seo_title: row.seo_title,
      seo_description: row.seo_description,
      sort_order: row.sort_order,
      publish_state: row.publish_state,
    },
    {
      site_key: 'dma',
      slug: 'adminjs-created-news',
      title: 'AdminJS Created News',
      summary: 'Created from AdminJS',
      body_html: '<p>Hello from AdminJS</p>',
      seo_title: 'AdminJS SEO title',
      seo_description: 'AdminJS SEO description',
      sort_order: 10,
      publish_state: 'published',
    },
  );
  assert.ok(row.published_at);
});
