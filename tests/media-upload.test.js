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

function listUploadFiles(uploadRoot) {
  if (!fs.existsSync(uploadRoot)) {
    return [];
  }

  return fs.readdirSync(uploadRoot);
}

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

test('media replacement can clear alt text with a blank submission', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-clear-alt-');
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
    .field('altText', '待清空替换文本')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('altText', '')
    .attach('file', replacementLogoFixturePath);

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/media');

  const updated = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(updated.alt_text, null);
  assert.match(updated.filename, /logo-replacement\.png/);
});

test('media library rebind updates assignment and metadata without uploading a file', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-rebind-');
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
    .field('altText', 'DMA bound asset')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');

  const listResponse = await agent.get(`/admin/media?siteKey=dma&edit=${asset.asset_key}`);
  assert.equal(listResponse.status, 200);
  assert.match(listResponse.text, new RegExp(`/admin/media/${asset.asset_key}/rebind`));

  const rebindResponse = await agent
    .post(`/admin/media/${asset.asset_key}/rebind`)
    .type('form')
    .send({
      siteKey: '',
      altText: 'Global asset copy',
    });

  assert.equal(rebindResponse.status, 302);
  assert.equal(rebindResponse.headers.location, '/admin/media');

  const updated = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(updated.site_key, null);
  assert.equal(updated.alt_text, 'Global asset copy');
  assert.equal(updated.filename, asset.filename);
  assert.equal(updated.storage_path, asset.storage_path);
});

test('media upload rejects invalid site binding without leaking files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-upload-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'rogue')
    .field('altText', '非法站点素材')
    .attach('file', logoFixturePath);

  assert.equal(response.status, 400);
  assert.match(response.text, /站点标识无效，请重新选择。/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects unsafe active-content files without leaking files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-unsafe-upload-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '恶意 HTML')
    .attach('file', `${__dirname}/fixtures/crawl-sample.html`);

  assert.equal(response.status, 400);
  assert.match(response.text, /不支持上传的文件类型/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media replacement rejects missing assets without reporting success or leaking files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-missing-replace-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/media/no-such-asset/replace')
    .field('altText', '不存在的素材')
    .attach('file', replacementLogoFixturePath);

  assert.equal(response.status, 404);
  assert.match(response.text, /未找到要替换的素材。/);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media replacement rejects invalid site binding and cleans up uploaded files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-replace-');
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
    .field('altText', 'DMA 待替换素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  const originalUploads = listUploadFiles(paths.uploadRoot);

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('siteKey', 'rogue')
    .field('altText', '非法替换')
    .attach('file', replacementLogoFixturePath);

  assert.equal(response.status, 400);
  assert.match(response.text, /站点标识无效，请重新选择。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.storage_path, asset.storage_path);
  assert.equal(unchanged.alt_text, asset.alt_text);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), originalUploads);
});

test('media rebind rejects invalid site binding as a recoverable admin error', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-rebind-');
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
    .field('altText', 'DMA 原素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/rebind`)
    .type('form')
    .send({
      siteKey: 'rogue',
      altText: '非法重绑',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /站点标识无效，请重新选择。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.site_key, 'dma');
  assert.equal(unchanged.alt_text, 'DMA 原素材');
});
