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

  const uploadResponsePage = await agent.get(updated.source_url);
  assert.equal(uploadResponsePage.status, 200);
  assert.equal(uploadResponsePage.headers['x-content-type-options'], 'nosniff');
});

test('admin inline image upload returns a direct uploads URL that can be embedded in rich text', async (t) => {
  const paths = createSeededAppPaths('b8-admin-inline-upload-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const response = await agent
    .post('/admin/media/inline-upload')
    .field('siteKey', 'dma')
    .field('altText', 'DMA inline upload')
    .attach('file', logoFixturePath);

  assert.equal(response.status, 201);
  assert.match(response.body.url, /^\/uploads\//);
  assert.match(response.body.filename, /logo\.png/);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  assert.equal(asset.alt_text, 'DMA inline upload');

  const uploadedFile = await agent.get(response.body.url);
  assert.equal(uploadedFile.status, 200);
  assert.equal(uploadedFile.headers['x-content-type-options'], 'nosniff');
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

test('media upload rejects spoofed active-content files renamed as png without leaking files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-spoofed-upload-');
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
    .field('altText', '伪装 PNG')
    .attach('file', `${__dirname}/fixtures/crawl-sample.html`, {
      filename: 'spoofed.png',
      contentType: 'image/png',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload accepts utf-8 chinese txt files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-cn-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const content = '第一行：中文内容\n第二行：UTF-8 文本。';
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '中文文本')
    .attach('file', Buffer.from(content, 'utf8'), {
      filename: 'cn.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/media');

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  assert.match(asset.filename, /cn\.txt/);
  assert.ok(fs.existsSync(asset.storage_path));
  assert.equal(fs.readFileSync(asset.storage_path, 'utf8'), content);
});

test('media upload accepts utf-8 chinese csv files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-cn-csv-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const content = '名称,说明\n设备,中文描述\n表格,UTF-8 内容';
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '中文 CSV')
    .attach('file', Buffer.from(content, 'utf8'), {
      filename: 'cn.csv',
      contentType: 'text/csv; charset=utf-8',
    });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/media');

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  assert.match(asset.filename, /cn\.csv/);
  assert.ok(fs.existsSync(asset.storage_path));
  assert.equal(fs.readFileSync(asset.storage_path, 'utf8'), content);
});

test('media upload accepts large utf-8 chinese txt files when the sniffing window ends mid-character', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-cn-large-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const content = `${'a'.repeat(65534)}中\n尾部内容`;
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '大文件中文文本')
    .attach('file', Buffer.from(content, 'utf8'), {
      filename: 'cn-large.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/media');

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  assert.match(asset.filename, /cn-large\.txt/);
  assert.ok(fs.existsSync(asset.storage_path));
  assert.equal(fs.readFileSync(asset.storage_path, 'utf8'), content);
});

test('media upload rejects malformed utf-8 txt files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-utf8-txt-');
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
    .field('altText', '损坏文本')
    .attach('file', Buffer.from([0x41, 0xe4]), {
      filename: 'invalid.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects exact-window malformed utf-8 txt files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-utf8-window-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const invalidWindowSizedPayload = Buffer.concat([
    Buffer.alloc(65533, 0x61),
    Buffer.from([0xe4, 0x41, 0x41]),
  ]);
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '窗口损坏文本')
    .attach('file', invalidWindowSizedPayload, {
      filename: 'invalid-window.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects large malformed utf-8 txt files that do not end on a real truncated character', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-utf8-large-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const invalidLargePayload = Buffer.concat([
    Buffer.alloc(65533, 0x61),
    Buffer.from([0xe4, 0x41, 0x41]),
    Buffer.from('tail', 'utf8'),
  ]);
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '大文件损坏文本')
    .attach('file', invalidLargePayload, {
      filename: 'invalid-large.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects large malformed utf-8 prefixes that can never form a valid character', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-invalid-utf8-prefix-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const invalidPrefixPayload = Buffer.concat([
    Buffer.alloc(65533, 0x61),
    Buffer.from([0xf0, 0x80, 0x80]),
    Buffer.from('tail', 'utf8'),
  ]);
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '非法 UTF-8 前缀')
    .attach('file', invalidPrefixPayload, {
      filename: 'invalid-prefix.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects xml-prolog svg content renamed as txt', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-xml-svg-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const payload = '<?xml version="1.0" encoding="UTF-8"?><svg><script>alert(1)</script></svg>';
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '伪装 SVG 文本')
    .attach('file', Buffer.from(payload, 'utf8'), {
      filename: 'spoofed.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count, 0);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), []);
});

test('media upload rejects xml-prolog svg content with leading comments renamed as txt', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-xml-comment-svg-txt-');
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath, sessionSecret: 'task4-secret', uploadRoot: paths.uploadRoot });
  const agent = request.agent(app);
  const db = createDatabase(paths.databasePath);
  t.after(() => db.close());

  await loginAsAdmin(agent);

  const payload = '<?xml version="1.0" encoding="UTF-8"?><!--comment--><svg><script>alert(1)</script></svg>';
  const response = await agent
    .post('/admin/media')
    .field('siteKey', 'dma')
    .field('altText', '带注释的伪装 SVG 文本')
    .attach('file', Buffer.from(payload, 'utf8'), {
      filename: 'spoofed-comment.txt',
      contentType: 'text/plain; charset=utf-8',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);
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

test('media rebind rejects moving a referenced asset to another site', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-rebind-reference-');
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
    .field('altText', 'DMA 已引用素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  db.prepare(`
    INSERT INTO products (site_key, slug, title, brochure_media_id, sort_order, publish_state)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('dma', 'referenced-product', '已引用产品', asset.id, 1, 'draft');

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/rebind`)
    .type('form')
    .send({
      siteKey: 'bigfoot',
      altText: '尝试跨站重绑',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /当前素材已被其他站点内容引用，不能迁移到该站点。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.site_key, 'dma');
  assert.equal(unchanged.alt_text, 'DMA 已引用素材');
});

test('media rebind rejects moving an asset referenced by another site section', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-rebind-section-reference-');
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
    .field('altText', 'DMA 模块素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  db.prepare(`
    INSERT INTO site_sections (site_key, section_key, heading, media_asset_id, config_json, is_published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('dma', 'hero-media-guard', 'DMA 模块引用', asset.id, '{}', 1, 1);

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/rebind`)
    .type('form')
    .send({
      siteKey: 'bigfoot',
      altText: '尝试跨站重绑模块素材',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /当前素材已被其他站点内容引用，不能迁移到该站点。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.site_key, 'dma');
  assert.equal(unchanged.alt_text, 'DMA 模块素材');
});

test('media replacement rejects moving a referenced asset to another site and cleans up uploaded files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-replace-reference-');
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
    .field('altText', 'DMA 替换前素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  db.prepare(`
    INSERT INTO products (site_key, slug, title, attachment_media_id, sort_order, publish_state)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('dma', 'replace-guard-product', '替换保护产品', asset.id, 2, 'draft');
  const originalUploads = listUploadFiles(paths.uploadRoot);

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('siteKey', 'bigfoot')
    .field('altText', '尝试跨站替换')
    .attach('file', replacementLogoFixturePath);

  assert.equal(response.status, 400);
  assert.match(response.text, /当前素材已被其他站点内容引用，不能迁移到该站点。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.site_key, 'dma');
  assert.equal(unchanged.storage_path, asset.storage_path);
  assert.equal(unchanged.alt_text, asset.alt_text);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), originalUploads);
});

test('media replacement rejects moving an asset referenced by another site section and cleans up uploaded files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-replace-section-reference-');
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
    .field('altText', 'DMA 模块替换前素材')
    .attach('file', logoFixturePath);

  const asset = db.prepare('SELECT * FROM media_assets WHERE site_key = ?').get('dma');
  db.prepare(`
    INSERT INTO site_sections (site_key, section_key, heading, media_asset_id, config_json, is_published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('dma', 'hero-media-replace-guard', 'DMA 模块引用', asset.id, '{}', 1, 2);
  const originalUploads = listUploadFiles(paths.uploadRoot);

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('siteKey', 'bigfoot')
    .field('altText', '尝试跨站替换模块素材')
    .attach('file', replacementLogoFixturePath);

  assert.equal(response.status, 400);
  assert.match(response.text, /当前素材已被其他站点内容引用，不能迁移到该站点。/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.site_key, 'dma');
  assert.equal(unchanged.storage_path, asset.storage_path);
  assert.equal(unchanged.alt_text, asset.alt_text);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), originalUploads);
});

test('media replacement rejects spoofed active-content files renamed as png without leaking files', async (t) => {
  const paths = createSeededAppPaths('b8-admin-media-spoofed-replace-');
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
  const originalUploads = listUploadFiles(paths.uploadRoot);

  const response = await agent
    .post(`/admin/media/${asset.asset_key}/replace`)
    .field('altText', '伪装替换')
    .attach('file', `${__dirname}/fixtures/crawl-sample.html`, {
      filename: 'spoofed.png',
      contentType: 'image/png',
    });

  assert.equal(response.status, 400);
  assert.match(response.text, /上传文件内容与文件类型不匹配/);

  const unchanged = db.prepare('SELECT * FROM media_assets WHERE asset_key = ?').get(asset.asset_key);
  assert.equal(unchanged.storage_path, asset.storage_path);
  assert.equal(unchanged.alt_text, asset.alt_text);
  assert.deepEqual(listUploadFiles(paths.uploadRoot), originalUploads);
});
