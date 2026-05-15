const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { DataTypes, Sequelize } = require('sequelize');

const { createApp } = require('../src/app');
const { authenticate, createAdminJsSessionCookieOptions } = require('../src/admin/adminjs/auth');
const { createMediaAssetsResource } = require('../src/admin/adminjs/resources/media-assets');
const { createSiteSettingsResource } = require('../src/admin/adminjs/resources/site-settings');
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

async function closeApp(app) {
  if (typeof app?.close === 'function') {
    await app.close();
    return;
  }

  app?.locals?.db?.close?.();
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

function createAdminRepositoryWithSeededAdmins(paths) {
  const db = createDatabase(paths.databasePath);
  runMigrations(db);
  const adminRepository = createAdminRepository(db);

  adminRepository.createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });

  adminRepository.createAdmin({
    username: 'disabled',
    email: 'disabled@b8.local',
    passwordHash: bcrypt.hashSync('Blocked123!', 10),
    displayName: '停用管理员',
    isActive: false,
  });

  return {
    adminRepository,
    close() {
      db.close();
    },
  };
}

test('authenticate accepts username or email for active admins', async (t) => {
  const paths = createTestPaths();
  const { adminRepository, close } = createAdminRepositoryWithSeededAdmins(paths);

  t.after(() => {
    close();
  });

  const [byUsername, byEmail] = await Promise.all([
    authenticate('admin', 'ChangeMe123!', adminRepository),
    authenticate('admin@b8.local', 'ChangeMe123!', adminRepository),
  ]);

  assert.deepEqual(byUsername, {
    id: byUsername.id,
    email: 'admin@b8.local',
    title: '平台管理员',
  });
  assert.deepEqual(byEmail, {
    id: byEmail.id,
    email: 'admin@b8.local',
    title: '平台管理员',
  });
  assert.equal(byUsername.id, byEmail.id);
});

test('authenticate rejects inactive admins even with valid credentials', async (t) => {
  const paths = createTestPaths();
  const { adminRepository, close } = createAdminRepositoryWithSeededAdmins(paths);

  t.after(() => {
    close();
  });

  const result = await authenticate('disabled', 'Blocked123!', adminRepository);

  assert.equal(result, null);
});

test('AdminJS session cookie options are secure in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminCookieSecure = process.env.ADMIN_COOKIE_SECURE;

  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_COOKIE_SECURE;

  try {
    assert.equal(createAdminJsSessionCookieOptions().secure, true);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminCookieSecure === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = originalAdminCookieSecure;
    }
  }
});

test('AdminJS session cookie options allow explicit insecure override in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminCookieSecure = process.env.ADMIN_COOKIE_SECURE;

  process.env.NODE_ENV = 'production';
  process.env.ADMIN_COOKIE_SECURE = 'false';

  try {
    assert.equal(createAdminJsSessionCookieOptions().secure, false);
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAdminCookieSecure === undefined) {
      delete process.env.ADMIN_COOKIE_SECURE;
    } else {
      process.env.ADMIN_COOKIE_SECURE = originalAdminCookieSecure;
    }
  }
});

test('GET /admin-next/login serves AdminJS while /admin/login remains on the legacy Chinese backend', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
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

test('GET /admin-next frontend javascript assets serve executable javascript for the login page', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const app = createApp({ databasePath: paths.databasePath });
  const [appBundleResponse, globalBundleResponse, designSystemResponse] = await Promise.all([
    request(app).get('/admin-next/frontend/assets/app.bundle.js'),
    request(app).get('/admin-next/frontend/assets/global.bundle.js'),
    request(app).get('/admin-next/frontend/assets/design-system.bundle.js'),
  ]);

  assert.equal(appBundleResponse.status, 200);
  assert.match(appBundleResponse.headers['content-type'], /javascript/);
  assert.match(appBundleResponse.text, /createRoot|ReactDOM/i);

  assert.equal(globalBundleResponse.status, 200);
  assert.match(globalBundleResponse.headers['content-type'], /javascript/);
  assert.match(globalBundleResponse.text, /window|globalThis|process/i);

  assert.equal(designSystemResponse.status, 200);
  assert.match(designSystemResponse.headers['content-type'], /javascript/);
  assert.match(designSystemResponse.text, /styled|DesignSystem/i);
});

test('POST /admin-next/login authenticates with AdminJS while /admin/login remains on the legacy backend', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
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
  assert.match(adminJsResponse.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(adminJsResponse.headers['set-cookie'][0], /SameSite=Lax/i);
  assert.equal(fs.existsSync(path.join(paths.tempDir, 'sessions.db')), true);

  assert.equal(legacyResponse.status, 302);
  assert.equal(legacyResponse.headers.location, '/admin');
  assert.match(legacyResponse.headers['set-cookie'][0], /b8_admin=/);
});

test('POST /admin-next/login accepts email credentials for AdminJS', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  createSeededAdminDb(paths);

  const app = createApp({ databasePath: paths.databasePath });
  const response = await request(app)
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin@b8.local', password: 'ChangeMe123!' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin-next');
  assert.match(response.headers['set-cookie'][0], /b8_adminjs=/);
});

test('POST /admin-next/login rejects inactive admins', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  const { close } = createAdminRepositoryWithSeededAdmins(paths);
  close();

  const app = createApp({ databasePath: paths.databasePath });
  const response = await request(app)
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'disabled', password: 'Blocked123!' });

  assert.equal(response.status, 200);
  assert.match(response.text, /invalidCredentials/i);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('GET /admin-next/logout destroys the AdminJS session', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  createSeededAdminDb(paths);

  const app = createApp({ databasePath: paths.databasePath });
  const agent = request.agent(app);

  const loginResponse = await agent
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const authenticatedResponse = await agent.get('/admin-next');
  assert.notEqual(authenticatedResponse.headers.location, '/admin-next/login');

  const logoutResponse = await agent.get('/admin-next/logout');
  assert.equal(logoutResponse.status, 302);
  assert.equal(logoutResponse.headers.location, '/admin-next/login');

  const postLogoutResponse = await agent.get('/admin-next');
  assert.equal(postLogoutResponse.status, 302);
  assert.equal(postLogoutResponse.headers.location, '/admin-next/login');
});

test('GET /admin-next revalidates active admins on every request', async (t) => {
  const paths = createTestPaths();
  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  createSeededAdminDb(paths);

  const app = createApp({ databasePath: paths.databasePath });
  const agent = request.agent(app);

  const loginResponse = await agent
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);

  const preDisableResponse = await agent.get('/admin-next');
  assert.notEqual(preDisableResponse.headers.location, '/admin-next/login');

  app.locals.db.prepare('UPDATE admins SET is_active = 0 WHERE username = ?').run('admin');

  const disabledResponse = await agent.get('/admin-next');
  assert.equal(disabledResponse.status, 302);
  assert.equal(disabledResponse.headers.location, '/admin-next/login');

  const afterDisableResponse = await agent.get('/admin-next');
  assert.equal(afterDisableResponse.status, 302);
  assert.equal(afterDisableResponse.headers.location, '/admin-next/login');
});

test('createApp exposes AdminJS cleanup for in-memory session artifacts', async (t) => {
  const app = createApp({ databasePath: ':memory:' });
  t.after(async () => {
    await closeApp(app);
  });

  app.locals.adminRepository.createAdmin({
    username: 'admin',
    email: 'admin@b8.local',
    passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
    displayName: '平台管理员',
  });

  const loginResponse = await request(app)
    .post('/admin-next/login')
    .type('form')
    .send({ email: 'admin', password: 'ChangeMe123!' });

  assert.equal(loginResponse.status, 302);
  assert.equal(typeof app.close, 'function');
  assert.equal(typeof app.locals.adminJs?.sessionDatabasePath, 'string');
  assert.equal(fs.existsSync(app.locals.adminJs.sessionDatabasePath), true);

  const sessionDirectory = path.dirname(app.locals.adminJs.sessionDatabasePath);

  await app.close();

  assert.equal(fs.existsSync(sessionDirectory), false);
});

test('AdminJS site settings resource rejects cross-site homepage media ids for all homepage media fields', async (t) => {
  const paths = createTestPaths();
  const app = createApp({ databasePath: paths.databasePath });
  const crossSiteAssetPath = path.join(paths.tempDir, 'bigfoot-home.png');

  t.after(async () => {
    await closeApp(app);
    fs.rmSync(paths.tempDir, { recursive: true, force: true });
  });

  fs.writeFileSync(crossSiteAssetPath, 'bigfoot image');
  app.locals.siteRepository.upsertSiteSettings({
    siteKey: 'dma',
    brandName: 'DMA',
    domain: 'dma.local',
  });
  app.locals.siteRepository.upsertSiteSettings({
    siteKey: 'bigfoot',
    brandName: 'Bigfoot',
    domain: 'bigfoot.local',
  });
  const crossSiteAsset = app.locals.mediaRepository.createAsset({
    assetKey: 'bigfoot-home-only',
    siteKey: 'bigfoot',
    filename: 'bigfoot-home.png',
    mimeType: 'image/png',
    storagePath: crossSiteAssetPath,
  });

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: paths.databasePath,
    logging: false,
  });

  t.after(async () => {
    await sequelize.close();
  });

  createMediaAssetsResource(sequelize, DataTypes);
  const { options } = createSiteSettingsResource(sequelize, DataTypes);
  const homepageMediaFields = [
    ['home_banner_media_id', '首页全宽图（第一张）'],
    ['home_banner_secondary_media_id', '首页全宽图（第二张）'],
    ['home_feature_media_id', '首页解决方案主图'],
  ];
  const before = options.actions.edit.before;

  assert.equal(typeof before, 'function');

  for (const [field, label] of homepageMediaFields) {
    await assert.rejects(
      before({
        method: 'post',
        payload: {
          site_key: 'dma',
          [field]: crossSiteAsset.id,
        },
      }, {
        currentAdmin: {
          siteKey: 'dma',
        },
      }),
      new RegExp(`${label}必须属于当前站点或全局素材，请重新选择。`),
    );
  }
});
