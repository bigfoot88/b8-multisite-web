const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createDatabase } = require('../src/lib/db');
const { createAdminRepository } = require('../src/repositories/admin-repository');
const { loginAsAdmin } = require('./helpers/login-as-admin');

const repoRoot = path.join(__dirname, '..');
const uploadRoot = path.join(repoRoot, 'public', 'uploads');

function runImporter(args, env = {}) {
  const stdout = execFileSync(process.execPath, ['scripts/import-seed-data.mjs', ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'pipe',
    encoding: 'utf8',
  });

  return JSON.parse(stdout);
}

function ensureSmokeAdmin(databasePath) {
  const db = createDatabase(databasePath);

  try {
    const adminRepository = createAdminRepository(db);
    if (!adminRepository.findByUsername('admin')) {
      adminRepository.createAdmin({
        username: 'admin',
        email: 'admin@b8.local',
        passwordHash: bcrypt.hashSync('ChangeMe123!', 10),
        displayName: '平台管理员',
      });
    }
  } finally {
    db.close();
  }
}

test('core pages and admin dashboard all work from one seeded database', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-e2e-smoke-'));
  const databasePath = path.join(tempDir, 'content.db');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  runImporter([
    '--site',
    'dma',
    '--seed',
    'data/seeds/dma.json',
    '--database-path',
    databasePath,
    '--upload-root',
    'public/uploads',
    '--apply',
  ]);
  runImporter([
    '--site',
    'bigfoot',
    '--seed',
    'data/seeds/bigfoot.json',
    '--database-path',
    databasePath,
    '--upload-root',
    'public/uploads',
    '--apply',
  ]);
  ensureSmokeAdmin(databasePath);

  const app = createApp({
    databasePath,
    sessionSecret: 'task7-smoke-secret',
    uploadRoot,
  });
  t.after(() => app.locals.db.close());

  const health = await request(app).get('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ok: true, sites: ['dma', 'bigfoot'] });

  const checks = [
    ['dma.b8water.com', '/', /DMA Lite · 夜间最小流量\+分区漏损监测方案/],
    ['dma.b8water.com', '/about', /关于智灵科技/],
    ['dma.b8water.com', '/products', /DMA Lite 夜间监测平台/],
    ['dma.b8water.com', '/products/dma-lite', /DMA Lite 夜间监测平台/],
    ['dma.b8water.com', '/solutions', /DMA Lite 分区漏损治理方案/],
    ['dma.b8water.com', '/solutions/dma-lite-solution', /DMA Lite 分区漏损治理方案/],
    ['dma.b8water.com', '/news', /供水管网漏损精准化治理观察/],
    ['dma.b8water.com', '/news/mnf-observation', /供水管网漏损精准化治理观察/],
    ['dma.b8water.com', '/cases', /清远供水分区治理案例/],
    ['dma.b8water.com', '/cases/qingyuan-water', /清远供水分区治理案例/],
    ['dma.b8water.com', '/contact', /科智西路 1 号/],
    ['www.chinabigfoot.com', '/', /选择B8ERP，开启智能水务新纪元/],
    ['www.chinabigfoot.com', '/about', /关于同创科技/],
    ['www.chinabigfoot.com', '/products', /B8ERP 收费营收一体化系统/],
    ['www.chinabigfoot.com', '/products/billing-suite', /B8ERP 收费营收一体化系统/],
    ['www.chinabigfoot.com', '/solutions', /智慧水务营收协同方案/],
    ['www.chinabigfoot.com', '/solutions/smart-water', /智慧水务营收协同方案/],
    ['www.chinabigfoot.com', '/news', /合同节水项目带动智慧水务升级/],
    ['www.chinabigfoot.com', '/news/contract-water-saving', /合同节水项目带动智慧水务升级/],
    ['www.chinabigfoot.com', '/cases', /中山供水营收数字化案例/],
    ['www.chinabigfoot.com', '/cases/zhongshan-water', /中山供水营收数字化案例/],
    ['www.chinabigfoot.com', '/contact', /中山市同创科技发展有限公司/],
  ];

  for (const [host, requestPath, pattern] of checks) {
    const response = await request(app)
      .get(requestPath)
      .set('host', host);

    assert.equal(response.status, 200, `${host} ${requestPath} should return 200`);
    assert.match(response.text, pattern, `${host} ${requestPath} should include imported content`);
  }

  const agent = request.agent(app);
  const loginResponse = await loginAsAdmin(agent);
  assert.equal(loginResponse.status, 302);

  const adminOverview = await agent.get('/admin');
  assert.equal(adminOverview.status, 200);
  assert.match(adminOverview.text, /站点总览/);
  assert.match(adminOverview.text, /媒体库/);

  const dmaDashboard = await agent.get('/admin/dma');
  assert.equal(dmaDashboard.status, 200);
  assert.match(dmaDashboard.text, /智灵科技/);
  assert.match(dmaDashboard.text, /首页模块：/);

  const bigfootDashboard = await agent.get('/admin/bigfoot');
  assert.equal(bigfootDashboard.status, 200);
  assert.match(bigfootDashboard.text, /中山市同创科技发展有限公司/);
  assert.match(bigfootDashboard.text, /快捷入口/);
});
