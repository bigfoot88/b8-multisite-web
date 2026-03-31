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

test('GET /admin/login serves the AdminJS login screen instead of the legacy Chinese login form', async (t) => {
  const paths = createTestPaths();
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath });
  const response = await request(app).get('/admin/login');

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.text, /AdminJS/i);
  assert.doesNotMatch(response.text, /管理员登录/);
  assert.doesNotMatch(response.text, /登录后进入中文后台总控台/);
});
