const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createDatabase } = require('../src/lib/db');
const { runMigrations } = require('../src/lib/migrations');
const { createAdminRepository } = require('../src/repositories/admin-repository');

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

function createSeededAdminDb(paths) {
  const db = createDatabase(paths.databasePath);
  runMigrations(db);

  createAdminRepository(db).createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });

  db.close();
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

test('POST /admin-next/login authenticates with AdminJS while /admin/login remains on the legacy backend', async (t) => {
  const paths = createTestPaths();
  t.after(() => {
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  createSeededAdminDb(paths);

  const app = createApp({ databasePath: paths.databasePath });
  const [adminJsResponse, legacyResponse] = await Promise.all([
    request(app)
      .post('/admin-next/login')
      .type('form')
      .send({ email: 'admin', password: 'ChangeMe123!' }),
    request(app)
      .post('/admin/login')
      .type('form')
      .send({ username: 'admin', password: 'ChangeMe123!' }),
  ]);

  assert.equal(adminJsResponse.status, 302);
  assert.equal(adminJsResponse.headers.location, '/admin-next');
  assert.match(adminJsResponse.headers['set-cookie'][0], /b8_adminjs=/);

  assert.equal(legacyResponse.status, 302);
  assert.equal(legacyResponse.headers.location, '/admin');
  assert.match(legacyResponse.headers['set-cookie'][0], /b8_admin=/);
});
