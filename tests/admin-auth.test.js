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
