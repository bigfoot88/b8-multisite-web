const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');

function createTestPaths() {
  const tempDir = path.join(
    __dirname,
    '.scratch',
    `admin-adminjs-auth-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  fs.mkdirSync(tempDir, { recursive: true });

  return {
    tempDir,
    databasePath: path.join(tempDir, 'content.db'),
  };
}

test('GET /admin-next/login serves AdminJS while /admin/login remains on the legacy Chinese backend', async (t) => {
  const paths = createTestPaths();
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath });
  const [adminJsResponse, legacyResponse] = await Promise.all([
    request(app).get('/admin-next/login'),
    request(app).get('/admin/login'),
  ]);

  assert.equal(adminJsResponse.status, 200);
  assert.match(adminJsResponse.headers['content-type'], /text\/html/);
  assert.match(adminJsResponse.text, /AdminJS/i);
  assert.doesNotMatch(adminJsResponse.text, /管理员登录/);
  assert.doesNotMatch(adminJsResponse.text, /登录后进入中文后台总控台/);

  assert.equal(legacyResponse.status, 200);
  assert.match(legacyResponse.headers['content-type'], /text\/html/);
  assert.match(legacyResponse.text, /管理员登录/);
  assert.match(legacyResponse.text, /登录后进入中文后台总控台/);
  assert.doesNotMatch(legacyResponse.text, /AdminJS/i);
});
