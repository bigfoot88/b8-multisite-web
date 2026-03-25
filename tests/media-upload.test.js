const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createDatabase } = require('../src/lib/db');
const { loginAsAdmin } = require('./helpers/login-as-admin');
const {
  createSeededAppPaths,
  logoFixturePath,
  replacementLogoFixturePath,
} = require('./helpers/test-paths');

test('media library uploads an asset and replaces it without changing asset identity', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const uploadResponse = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', 'DMA logo')
    .attach('file', logoFixturePath);

  assert.equal(uploadResponse.status, 302);
  assert.equal(uploadResponse.headers.location, '/admin/media');

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  assert.equal(asset.alt_text, 'DMA logo');
  assert.match(asset.filename, /logo\.png/);
  assert.ok(fs.existsSync(asset.storage_path));

  const replaceResponse = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('altText', 'DMA logo updated')
    .attach('file', replacementLogoFixturePath);

  assert.equal(replaceResponse.status, 302);
  assert.equal(replaceResponse.headers.location, '/admin/media');

  const updated = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(updated.id, asset.id);
  assert.equal(updated.alt_text, 'DMA logo updated');
  assert.match(updated.filename, /logo-replacement\.png/);
  assert.ok(fs.existsSync(updated.storage_path));
  assert.notEqual(updated.storage_path, asset.storage_path);

  const mediaPage = await agent.get('/admin/media?siteKey=dma');
  assert.match(mediaPage.text, /DMA logo updated/);
  assert.match(mediaPage.text, /logo-replacement\.png/);
});

test('media library ignores invalid site filters instead of failing', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-filter-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);

  await loginAsAdmin(agent);

  const response = await agent.get('/admin/media?siteKey=rogue');

  assert.equal(response.status, 200);
  assert.match(response.text, /媒体库/);
});

test('media replacement can move a site asset into the global library', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-global-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', 'DMA site asset')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');

  const replaceResponse = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('siteKey', '')
    .field('altText', 'Now global')
    .attach('file', replacementLogoFixturePath);

  assert.equal(replaceResponse.status, 302);

  const updated = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(updated.site_key, null);
  assert.equal(updated.alt_text, 'Now global');
});
