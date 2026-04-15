const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const { createApp } = require('../src/app');
const { createDatabase } = require('../src/lib/db');
const { runMigrations } = require('../src/lib/migrations');
const { createAdminRepository } = require('../src/repositories/admin-repository');

function createSeededAdminDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-admin-auth-'));
  const testDbPath = path.join(tempDir, 'content.db');
  const db = createDatabase(testDbPath);
  runMigrations(db);

  createAdminRepository(db).createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });

  db.close();
  return { tempDir, testDbPath };
}

test('successful admin login redirects to the Chinese dashboard', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const response = await request(app)
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin');
  assert.match(response.headers['set-cookie'][0], /b8_admin=/);
});

test('disabled admin sessions are rejected on protected routes', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const agent = request.agent(app);

  const loginResponse = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);
  assert.equal(loginResponse.headers.location, '/admin');

  const db = createDatabase(testDbPath);
  db.prepare('UPDATE admins SET is_active = 0 WHERE username = ?').run('admin');
  db.close();

  const response = await agent.get('/admin');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/login');
  assert.match(response.headers['set-cookie'][0], /b8_admin=.*Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});

test('unknown admin site keys redirect to the admin dashboard', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const agent = request.agent(app);

  const loginResponse = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);
  assert.equal(loginResponse.headers.location, '/admin');

  const response = await agent.get('/admin/not-a-site');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin');
});

test('admin site settings form accepts homepage media ids', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const agent = request.agent(app);

  const primaryBanner = app.locals.mediaRepository.createAsset({
    assetKey: 'dma-home-primary',
    siteKey: 'dma',
    filename: 'dma-home-primary.png',
    mimeType: 'image/png',
    storagePath: path.join(app.locals.uploadRoot, 'dma-home-primary.png'),
  });
  const secondaryBanner = app.locals.mediaRepository.createAsset({
    assetKey: 'dma-home-secondary',
    siteKey: 'dma',
    filename: 'dma-home-secondary.png',
    mimeType: 'image/png',
    storagePath: path.join(app.locals.uploadRoot, 'dma-home-secondary.png'),
  });
  const featureAsset = app.locals.mediaRepository.createAsset({
    assetKey: 'dma-home-feature',
    siteKey: 'dma',
    filename: 'dma-home-feature.png',
    mimeType: 'image/png',
    storagePath: path.join(app.locals.uploadRoot, 'dma-home-feature.png'),
  });

  const loginResponse = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: 'DMA',
      domain: 'dma.b8water.com',
      homeBannerMediaId: String(primaryBanner.id),
      homeBannerSecondaryMediaId: String(secondaryBanner.id),
      homeFeatureMediaId: String(featureAsset.id),
    });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/dma/settings');

  const row = app.locals.db.prepare(`
    SELECT home_banner_media_id, home_banner_secondary_media_id, home_feature_media_id
    FROM site_settings
    WHERE site_key = ?
  `).get('dma');
  assert.equal(row.home_banner_media_id, primaryBanner.id);
  assert.equal(row.home_banner_secondary_media_id, secondaryBanner.id);
  assert.equal(row.home_feature_media_id, featureAsset.id);

  const page = await agent.get('/admin/dma/settings');
  assert.equal(page.status, 200);
  assert.match(page.text, /name="homeBannerMediaId"/);
  assert.match(page.text, /name="homeBannerSecondaryMediaId"/);
  assert.match(page.text, /name="homeFeatureMediaId"/);
  assert.match(page.text, /dma-home-feature\.png/);
});

test('admin site settings form rejects malformed non-empty homepage media ids', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const agent = request.agent(app);

  const loginResponse = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: 'DMA',
      domain: 'dma.b8water.com',
      homeBannerMediaId: 'not-a-number',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /首页全宽图（第一张）必须是有效的媒体资源编号，请重新选择。/);

  const row = app.locals.db.prepare(`
    SELECT home_banner_media_id
    FROM site_settings
    WHERE site_key = ?
  `).get('dma');
  assert.equal(row, undefined);
});

test('admin site settings form rejects repeated homepage media ids instead of clearing them', async (t) => {
  const { tempDir, testDbPath } = createSeededAdminDb();
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: testDbPath });
  const agent = request.agent(app);

  const originalBanner = app.locals.mediaRepository.createAsset({
    assetKey: 'dma-home-original-banner',
    siteKey: 'dma',
    filename: 'dma-home-original-banner.png',
    mimeType: 'image/png',
    storagePath: path.join(app.locals.uploadRoot, 'dma-home-original-banner.png'),
  });
  const duplicateBanner = app.locals.mediaRepository.createAsset({
    assetKey: 'dma-home-duplicate-banner',
    siteKey: 'dma',
    filename: 'dma-home-duplicate-banner.png',
    mimeType: 'image/png',
    storagePath: path.join(app.locals.uploadRoot, 'dma-home-duplicate-banner.png'),
  });

  app.locals.siteRepository.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.b8water.com',
    homeBannerMediaId: originalBanner.id,
  });

  const loginResponse = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      brandName: 'DMA',
      domain: 'dma.b8water.com',
      homeBannerMediaId: [String(originalBanner.id), String(duplicateBanner.id)],
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /首页全宽图（第一张）必须是有效的媒体资源编号，请重新选择。/);

  const row = app.locals.db.prepare(`
    SELECT home_banner_media_id
    FROM site_settings
    WHERE site_key = ?
  `).get('dma');
  assert.equal(row.home_banner_media_id, originalBanner.id);
});
