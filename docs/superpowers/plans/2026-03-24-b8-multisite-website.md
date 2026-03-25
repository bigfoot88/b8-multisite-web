# B8 Multisite Website Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh self-hosted repository that recreates `dma.b8water.com` and `www.chinabigfoot.com` in one multisite platform with a shared Chinese admin backend and local media/content management.

**Architecture:** Use one Node.js repository with an Express server-rendered public site plus a Chinese admin application in the same process, backed by SQLite for structured content and local file storage for uploads. Model content per site (`dma` / `bigfoot`), use a shared design system with per-site theme tokens, and treat brochures/downloadables as media assets attached to products, solutions, or pages rather than as a separate subsystem.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, Multer, bcryptjs, cookie-based auth/session helpers, vanilla CSS/JS, `node:test`, `supertest`

---

### Task 1: Bootstrap the repository and HTTP app skeleton

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/server.js`
- Create: `src/app.js`
- Create: `src/config/env.js`
- Create: `src/config/sites.js`
- Create: `src/views/layouts/base.ejs`
- Create: `src/views/public/landing.ejs`
- Create: `public/css/public.css`
- Test: `tests/app-smoke.test.js`

- [ ] **Step 1: Create the Node.js scaffold (configuration exception to TDD)**

```bash
cd /Users/mac/project/b8-multisite-web
npm init -y
npm pkg set scripts.start="node src/server.js"
npm pkg set scripts.dev="node --watch src/server.js"
npm pkg set scripts.test="node --test"
```

- [ ] **Step 2: Install runtime and test dependencies**

```bash
npm install express ejs better-sqlite3 multer bcryptjs cookie-parser sanitize-html mime-types
npm install -D supertest
```

- [ ] **Step 3: Write the failing smoke test**

```js
test('GET /health returns ok with both site keys', async () => {
  const app = createApp();
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, sites: ['dma', 'bigfoot'] });
});
```

- [ ] **Step 4: Run the smoke test to verify it fails**

Run: `node --test tests/app-smoke.test.js`
Expected: FAIL because `createApp` / `src/app.js` does not exist yet.

- [ ] **Step 5: Write the minimal HTTP app and landing page**

```js
function createApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.get('/health', (req, res) => res.json({ ok: true, sites: ['dma', 'bigfoot'] }));
  app.get('/', (req, res) => res.render('public/landing'));
  return app;
}
```

- [ ] **Step 6: Re-run the smoke test to verify it passes**

Run: `node --test tests/app-smoke.test.js`
Expected: PASS

- [ ] **Step 7: Commit the bootstrap**

```bash
git add package.json package-lock.json .gitignore .env.example src public tests
git commit -m $'feat: bootstrap multisite express app\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 2: Capture the migration inventory and create the SQLite schema

**Files:**
- Create: `data/migration/dma/inventory.json`
- Create: `data/migration/bigfoot/inventory.json`
- Create: `data/migration/redirects.json`
- Create: `data/seeds/dma.json`
- Create: `data/seeds/bigfoot.json`
- Create: `scripts/crawl-site.mjs`
- Create: `src/lib/db.js`
- Create: `src/lib/migrations.js`
- Create: `src/lib/schema.sql`
- Create: `src/repositories/site-repository.js`
- Create: `src/repositories/catalog-repository.js`
- Create: `src/repositories/media-repository.js`
- Create: `src/repositories/admin-repository.js`
- Create: `src/repositories/redirect-repository.js`
- Create: `scripts/seed-admin.mjs`
- Test: `tests/crawl-inventory.test.js`
- Test: `tests/fixtures/crawl-sample.html`
- Create: `tests/helpers/create-seeded-db.js`
- Test: `tests/repositories.test.js`

- [ ] **Step 1: Write the failing migration-inventory test**

```js
test('crawler inventory extracts product/news links and asset urls from sample html', async () => {
  const inventory = await buildInventoryFromHtml('tests/fixtures/crawl-sample.html');

  assert.equal(inventory.pages.includes('/news'), true);
  assert.equal(inventory.assets.some((item) => item.includes('.png')), true);
});
```

- [ ] **Step 2: Run the inventory test to verify it fails**

Run: `node --test tests/crawl-inventory.test.js`
Expected: FAIL because the crawler/inventory builder does not exist yet.

- [ ] **Step 3: Implement the crawler and create the concrete migration inventories before modeling the database**

Run:

```bash
node scripts/crawl-site.mjs --site dma --base-url http://dma.b8water.com
node scripts/crawl-site.mjs --site bigfoot --base-url https://www.chinabigfoot.com
```

Expected: writes curated page/media inventories plus an initial redirect map into `data/migration/`.

The curated inventory must also record any public brochure/download file so it can be imported later as a media asset attachment.

- [ ] **Step 4: Write the failing repository test**

```js
test('repository layer can create a dma product and list it by site', () => {
  const db = createTestDb();
  runMigrations(db);
  const catalog = createCatalogRepository(db);

  catalog.createProduct({
    siteKey: 'dma',
    slug: 'dma-lite',
    title: 'DMA Lite',
    summary: 'Leakage monitoring',
  });

  assert.equal(catalog.listProducts('dma')[0].slug, 'dma-lite');
});
```

- [ ] **Step 5: Run the repository test to verify it fails**

Run: `node --test tests/repositories.test.js`
Expected: FAIL because database helpers and repositories do not exist yet.

- [ ] **Step 6: Write the schema and migration runner using the captured inventory as the source of truth**

```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
  site_key TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  brand_full_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  logo_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  contact_qr_media_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE navigation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_external INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  deleted_at TEXT
);

CREATE TABLE site_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  media_id INTEGER,
  cta_label TEXT,
  cta_href TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, section_key)
);

CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT,
  summary TEXT,
  attachment_media_id INTEGER,
  cover_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, path)
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  brochure_media_id INTEGER,
  cover_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, slug)
);

CREATE TABLE solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  attachment_media_id INTEGER,
  cover_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, slug)
);

CREATE TABLE news_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_html TEXT,
  cover_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, slug)
);

CREATE TABLE case_studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT,
  cover_media_id INTEGER,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  deleted_at TEXT,
  UNIQUE(site_key, slug)
);

CREATE TABLE media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT,
  asset_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  alt_text TEXT,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE redirect_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_query TEXT NOT NULL DEFAULT '',
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 302,
  UNIQUE(site_key, source_path, source_query)
);
```

- [ ] **Step 7: Implement repository methods for site settings, homepage sections/banners (including hero content as the only homepage-banner source of truth), catalog content, global media metadata with optional site assignment, admins, redirects, and a reusable seeded-test-database helper**

```js
function createCatalogRepository(db) {
  return {
    createProduct(input) { /* insert into products */ },
    listProducts(siteKey) { /* select by site */ },
  };
}
```

- [ ] **Step 8: Seed the default admin account and empty site records**

Run: `node scripts/seed-admin.mjs`
Expected: creates one admin user plus default `dma` and `bigfoot` site rows in the SQLite database.

- [ ] **Step 9: Re-run the inventory and repository tests**

Run: `node --test tests/crawl-inventory.test.js tests/repositories.test.js`
Expected: PASS

- [ ] **Step 10: Commit the inventory and persistence layer**

```bash
git add data scripts src/lib src/repositories tests/crawl-inventory.test.js tests/fixtures tests/repositories.test.js
git commit -m $'feat: add sqlite content repositories\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 3: Implement admin authentication and the Chinese admin shell

**Files:**
- Create: `src/lib/passwords.js`
- Create: `src/lib/session.js`
- Create: `src/routes/admin-auth.js`
- Create: `src/routes/admin-dashboard.js`
- Create: `src/views/layouts/admin.ejs`
- Create: `src/views/admin/login.ejs`
- Create: `src/views/admin/dashboard.ejs`
- Create: `public/css/admin.css`
- Test: `tests/admin-auth.test.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write the failing admin auth test**

```js
test('successful admin login redirects to the Chinese dashboard', async () => {
  const app = createApp({ databasePath: testDbPath });
  const response = await request(app)
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin');
  assert.match(response.headers['set-cookie'][0], /b8_admin=/);
});
```

- [ ] **Step 2: Run the auth test to verify it fails**

Run: `node --test tests/admin-auth.test.js`
Expected: FAIL because `/admin/login` and auth helpers do not exist yet.

- [ ] **Step 3: Implement password hashing, signed cookie sessions, and auth middleware**

```js
function requireAdmin(req, res, next) {
  const adminSession = readAdminSession(req);
  if (!adminSession) return res.redirect('/admin/login');
  next();
}
```

- [ ] **Step 4: Add the Chinese admin layout, login page, and dashboard**

```ejs
<aside>
  <a href="/admin/dma">DMA 站点</a>
  <a href="/admin/bigfoot">同创站点</a>
  <a href="/admin/media">媒体库</a>
</aside>
```

- [ ] **Step 5: Re-run the auth test and the smoke test**

Run: `node --test tests/admin-auth.test.js tests/app-smoke.test.js`
Expected: PASS

- [ ] **Step 6: Commit the admin shell**

```bash
git add src/lib/passwords.js src/lib/session.js src/routes src/views public/css/admin.css tests/admin-auth.test.js src/app.js
git commit -m $'feat: add chinese admin login shell\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 4: Build the admin CRUD surfaces for site content and media

**Files:**
- Create: `src/routes/admin-sites.js`
- Create: `src/routes/admin-pages.js`
- Create: `src/routes/admin-catalog.js`
- Create: `src/routes/admin-news.js`
- Create: `src/routes/admin-cases.js`
- Create: `src/routes/admin-media.js`
- Create: `src/routes/admin-navigation.js`
- Create: `src/routes/admin-sections.js`
- Create: `src/lib/uploads.js`
- Create: `src/views/admin/lists/site-settings.ejs`
- Create: `src/views/admin/lists/sections.ejs`
- Create: `src/views/admin/lists/navigation.ejs`
- Create: `src/views/admin/lists/pages.ejs`
- Create: `src/views/admin/lists/products.ejs`
- Create: `src/views/admin/lists/solutions.ejs`
- Create: `src/views/admin/lists/news.ejs`
- Create: `src/views/admin/lists/cases.ejs`
- Create: `src/views/admin/lists/media.ejs`
- Create: `src/views/admin/forms/site-settings.ejs`
- Create: `src/views/admin/forms/section.ejs`
- Create: `src/views/admin/forms/navigation-item.ejs`
- Create: `src/views/admin/forms/page.ejs`
- Create: `src/views/admin/forms/product.ejs`
- Create: `src/views/admin/forms/solution.ejs`
- Create: `src/views/admin/forms/news.ejs`
- Create: `src/views/admin/forms/case.ejs`
- Create: `tests/helpers/login-as-admin.js`
- Create: `tests/helpers/test-paths.js`
- Create: `tests/fixtures/logo.png`
- Create: `tests/fixtures/logo-replacement.png`
- Test: `tests/admin-crud.test.js`
- Test: `tests/media-upload.test.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write the failing CRUD test for a product**

```js
test('admin can create and then update a dma product from the chinese form', async () => {
  const agent = await loginAsAdmin(createApp({ databasePath: testDbPath }));
  const createResponse = await agent
    .post('/admin/dma/products')
    .type('form')
    .send({ slug: 'dma-lite', title: 'DMA Lite', summary: '夜间最小流量监测', status: 'published' });

  assert.equal(createResponse.status, 302);
  await agent
    .post('/admin/dma/products/dma-lite')
    .type('form')
    .send({ title: 'DMA Lite 升级版', summary: '更新后的摘要', status: 'published' });

  const listPage = await agent.get('/admin/dma/products');
  assert.match(listPage.text, /DMA Lite 升级版/);
});
```

- [ ] **Step 2: Write the failing homepage-section publish-state test**

```js
test('draft homepage banner does not render publicly until an admin publishes it', async () => {
  const app = createApp({ databasePath: testDbPath });
  const agent = await loginAsAdmin(app);

  await agent
    .post('/admin/dma/sections')
    .type('form')
    .send({ sectionKey: 'hero-banner', title: '春季水务专题', body: '测试 Banner', status: 'draft' });

  const beforePublish = await request(app).get('/').set('Host', 'dma.b8water.com');
  assert.doesNotMatch(beforePublish.text, /春季水务专题/);

  await agent.post('/admin/dma/sections/hero-banner/publish');

  const afterPublish = await request(app).get('/').set('Host', 'dma.b8water.com');
  assert.match(afterPublish.text, /春季水务专题/);
});
```

- [ ] **Step 3: Write the failing site-settings contact/SEO test**

```js
test('admin can update dma contact info and seo fields', async () => {
  const agent = await loginAsAdmin(createApp({ databasePath: testDbPath }));

  const response = await agent
    .post('/admin/dma/settings')
    .type('form')
    .send({
      contactPhone: '400-660-3328',
      contactAddress: '深圳市南山区科技园',
      seoTitle: '智灵科技官网',
      seoDescription: 'DMA 与 AI 抄表解决方案',
    });

  assert.equal(response.status, 302);

  const settingsPage = await agent.get('/admin/dma/settings');
  assert.match(settingsPage.text, /400-660-3328/);
  assert.match(settingsPage.text, /智灵科技官网/);
});
```

- [ ] **Step 4: Write the failing cross-domain CRUD coverage test**

```js
test('admin can create navigation, page, solution, news article, and case study records for bigfoot', async () => {
  const agent = await loginAsAdmin(createApp({ databasePath: testDbPath }));

  await agent.post('/admin/bigfoot/navigation').type('form').send({ label: '行业动态', href: '/news', sortOrder: 20 });
  await agent.post('/admin/bigfoot/pages').type('form').send({ path: '/development-history', title: '发展历程', status: 'published' });
  await agent.post('/admin/bigfoot/solutions').type('form').send({ slug: 'smart-water', title: '智慧水务方案', status: 'published' });
  await agent.post('/admin/bigfoot/news').type('form').send({ slug: 'policy-update', title: '行业政策更新', status: 'published' });
  await agent.post('/admin/bigfoot/cases').type('form').send({ slug: 'zhongshan-water', title: '中山供水案例', status: 'published' });

  const dashboard = await agent.get('/admin/bigfoot');
  assert.match(dashboard.text, /发展历程/);
  assert.match(dashboard.text, /智慧水务方案/);
  assert.match(dashboard.text, /行业政策更新/);
  assert.match(dashboard.text, /中山供水案例/);
});
```

- [ ] **Step 5: Write the failing soft-delete / filter / sort test**

```js
test('admin product list filters by site, sorts by sortOrder, and hides soft-deleted rows by default', async () => {
  const agent = await loginAsAdmin(createApp({ databasePath: testDbPath }));

  const listPage = await agent.get('/admin/dma/products?sort=sortOrder&status=active');

  assert.match(listPage.text, /sortOrder/);
  assert.doesNotMatch(listPage.text, /已删除/);
});
```

- [ ] **Step 6: Write the failing media upload-and-replacement test**

```js
test('admin can upload a local image into the media library and replace it later', async () => {
  const agent = await loginAsAdmin(createApp({ databasePath: testDbPath }));
  const createResponse = await agent.post('/admin/media').attach('file', 'tests/fixtures/logo.png');
  assert.equal(createResponse.status, 302);

  const replaceResponse = await agent
    .post('/admin/media/logo/replace')
    .attach('file', 'tests/fixtures/logo-replacement.png');

  assert.equal(replaceResponse.status, 302);
});
```

- [ ] **Step 7: Run the CRUD and media tests to verify they fail**

Run: `node --test tests/admin-crud.test.js tests/media-upload.test.js`
Expected: FAIL because CRUD routes, forms, and upload storage do not exist yet.

- [ ] **Step 8: Implement shared admin list/form routes for site settings, homepage sections/banners (hero, highlights, stat cards, preview blocks), navigation, pages, products, solutions, news, cases, and a global media library (`/admin/media`) with site filters, including edit/update, soft delete, filtering, and sorting**

```js
router.post('/:siteKey/products', requireAdmin, upload.none(), (req, res) => {
  catalogRepository.createProduct(parseProductForm(req.body));
  res.redirect(`/admin/${req.params.siteKey}/products`);
});
```

- [ ] **Step 9: Implement local upload storage under `public/uploads/` plus media metadata persistence and replacement/rebinding endpoints**

```js
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: createTimestampedName,
});
```

- [ ] **Step 10: Re-run the CRUD and media tests**

Run: `node --test tests/admin-crud.test.js tests/media-upload.test.js`
Expected: PASS

- [ ] **Step 11: Commit the admin CRUD layer**

```bash
git add src/routes src/lib/uploads.js src/views/admin src/app.js tests/admin-crud.test.js tests/media-upload.test.js public/uploads/.gitkeep
git commit -m $'feat: add chinese admin crud surfaces\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 5: Render the two public sites and wire legacy redirects

**Files:**
- Create: `src/lib/host-routing.js`
- Create: `src/services/public-site-service.js`
- Create: `src/routes/public.js`
- Create: `src/views/public/home.ejs`
- Create: `src/views/public/about.ejs`
- Create: `src/views/public/products.ejs`
- Create: `src/views/public/product-detail.ejs`
- Create: `src/views/public/solutions.ejs`
- Create: `src/views/public/solution-detail.ejs`
- Create: `src/views/public/news-index.ejs`
- Create: `src/views/public/news-detail.ejs`
- Create: `src/views/public/cases.ejs`
- Create: `src/views/public/case-detail.ejs`
- Create: `src/views/public/page.ejs`
- Create: `src/views/public/contact.ejs`
- Create: `src/views/public/not-found.ejs`
- Create: `src/views/partials/public-header.ejs`
- Create: `src/views/partials/public-footer.ejs`
- Create: `src/views/partials/hero.ejs`
- Create: `public/css/themes.css`
- Create: `public/js/site.js`
- Test: `tests/public-routing.test.js`
- Test: `tests/redirects.test.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write the failing public routing test**

```js
test('dma host resolves to the dma homepage without a /dma prefix', async () => {
  const app = createApp({ databasePath: seededDbPath });
  const response = await request(app).get('/').set('Host', 'dma.b8water.com');

  assert.equal(response.status, 200);
  assert.match(response.text, /DMA Lite/);
});
```

- [ ] **Step 2: Write the failing generic page-route / publish-visibility test**

```js
test('published company-history page renders publicly while draft pages stay hidden', async () => {
  const app = createApp({ databasePath: seededDbPath });
  const pageResponse = await request(app).get('/development-history').set('Host', 'www.chinabigfoot.com');
  const solutionResponse = await request(app).get('/solutions/smart-water').set('Host', 'www.chinabigfoot.com');

  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.text, /发展历程/);
  assert.equal(solutionResponse.status, 200);
  assert.match(solutionResponse.text, /智慧水务方案/);
});
```

- [ ] **Step 3: Write the failing brochure/download-link rendering test**

```js
test('bigfoot product page renders a migrated local brochure link', async () => {
  const app = createApp({ databasePath: seededDbPath });
  const response = await request(app).get('/products/billing-suite').set('Host', 'www.chinabigfoot.com');

  assert.equal(response.status, 200);
  assert.match(response.text, /产品画册|下载资料/);
  assert.match(response.text, /\/uploads\//);
});
```

- [ ] **Step 4: Write the failing redirect test**

```js
test('legacy nd.jsp url redirects to the mapped news article', async () => {
  const app = createApp({ databasePath: seededDbPath });
  const response = await request(app).get('/nd.jsp?id=111').set('Host', 'dma.b8water.com');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/news/mnf-observation');
});
```

- [ ] **Step 5: Run the public routing tests to verify they fail**

Run: `node --test tests/public-routing.test.js tests/redirects.test.js`
Expected: FAIL because host routing, templates, and redirect lookup do not exist yet.

- [ ] **Step 6: Implement site resolution, generic page rendering with hierarchical `path` support, brochure/download link rendering, public routes, and EJS templates for all core pages**

```js
app.use(resolveSiteFromHostOrPrefix);
app.get('/products/:slug', renderProductDetail);
app.get('/solutions/:slug', renderSolutionDetail);
app.get('/cases/:slug', renderCaseDetail);
app.get('/news/:slug', renderNewsDetail);
app.get('*', renderGenericPage); // keep this after the specific collections and resolve by stored page.path
```

- [ ] **Step 7: Implement the shared visual system with per-site theme tokens**

```css
.site--dma { --brand-primary: #0d6efd; }
.site--bigfoot { --brand-primary: #1273d4; }
```

- [ ] **Step 8: Re-run the public routing tests**

Run: `node --test tests/public-routing.test.js tests/redirects.test.js`
Expected: PASS

- [ ] **Step 9: Commit the public site layer**

```bash
git add src/lib/host-routing.js src/services src/routes/public.js src/views/public src/views/partials public/css public/js tests/public-routing.test.js tests/redirects.test.js src/app.js
git commit -m $'feat: add multisite public rendering\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 6: Download source assets and import the seeded data

**Files:**
- Create: `data/seeds/dma.json`
- Create: `data/seeds/bigfoot.json`
- Create: `scripts/download-assets.mjs`
- Create: `scripts/import-seed-data.mjs`
- Test: `tests/importer.test.js`
- Test: `tests/fixtures/crawl-sample.html`

- [ ] **Step 1: Write the failing importer test**

```js
test('seed importer turns dma seed data into products, pages, and redirects', async () => {
  const result = await importSeedFile({
    databasePath: testDbPath,
    seedPath: 'data/seeds/dma.json',
  });

  assert.equal(result.productsCreated > 0, true);
  assert.equal(result.navigationCreated > 0, true);
  assert.equal(result.siteSettingsUpdated, true);
  assert.equal(result.redirectsCreated > 0, true);
});
```

- [ ] **Step 2: Run the importer test to verify it fails**

Run: `node --test tests/importer.test.js`
Expected: FAIL because crawler/import scripts and seed files do not exist yet.

- [ ] **Step 3: Finalize the seed files from the inventories captured in Task 2**

Expected: the curated seed files cover the planned site settings, contact info, SEO defaults, navigation, pages, banners, products, solutions, news, cases, media assets, and redirect rows.

The curated seeds must include at least one stable solution-detail slug and one stable case-detail slug per site so `/solutions/:slug` and `/cases/:slug` can be verified end-to-end.

- [ ] **Step 4: Implement the asset downloader and normalized seed importer**

```bash
node scripts/download-assets.mjs --site dma
node scripts/download-assets.mjs --site bigfoot
node scripts/import-seed-data.mjs --site dma --seed data/seeds/dma.json --apply
node scripts/import-seed-data.mjs --site bigfoot --seed data/seeds/bigfoot.json --apply
```

- [ ] **Step 5: Re-run the importer test**

Run: `node --test tests/importer.test.js`
Expected: PASS

- [ ] **Step 6: Spot-check imported content**

Run:

```bash
node src/server.js
# in another shell
curl -I http://localhost:3000/health
curl -H 'Host: dma.b8water.com' http://localhost:3000/ | head
curl -H 'Host: www.chinabigfoot.com' http://localhost:3000/ | head
```

Expected: health endpoint is 200 and both homepages render imported content.

- [ ] **Step 7: Commit the migration assets and seed tooling**

```bash
git add data scripts public/uploads tests/importer.test.js tests/fixtures
git commit -m $'feat: import source content and local assets\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```

### Task 7: Finish visual polish, deployment docs, and full verification

**Files:**
- Create: `README.md`
- Create: `docs/deployment/alicloud.md`
- Create: `tests/end-to-end-smoke.test.js`
- Modify: `public/css/public.css`
- Modify: `public/css/admin.css`
- Modify: `src/views/public/*.ejs`
- Modify: `src/views/admin/*.ejs`

- [ ] **Step 1: Write the failing end-to-end smoke test**

```js
test('core pages and admin dashboard all work from one seeded database', async () => {
  const app = createApp({ databasePath: seededDbPath });

  const dmaHome = await request(app).get('/').set('Host', 'dma.b8water.com');
  const dmaAbout = await request(app).get('/about').set('Host', 'dma.b8water.com');
  const dmaProducts = await request(app).get('/products').set('Host', 'dma.b8water.com');
  const dmaSolutions = await request(app).get('/solutions').set('Host', 'dma.b8water.com');
  const dmaSolutionDetail = await request(app).get('/solutions/dma-lite-solution').set('Host', 'dma.b8water.com');
  const dmaProductDetail = await request(app).get('/products/dma-lite').set('Host', 'dma.b8water.com');
  const dmaNews = await request(app).get('/news').set('Host', 'dma.b8water.com');
  const dmaNewsDetail = await request(app).get('/news/mnf-observation').set('Host', 'dma.b8water.com');
  const dmaCases = await request(app).get('/cases').set('Host', 'dma.b8water.com');
  const dmaCaseDetail = await request(app).get('/cases/qingyuan-water').set('Host', 'dma.b8water.com');
  const dmaContact = await request(app).get('/contact').set('Host', 'dma.b8water.com');
  const bigfootHome = await request(app).get('/').set('Host', 'www.chinabigfoot.com');
  const bigfootAbout = await request(app).get('/about').set('Host', 'www.chinabigfoot.com');
  const bigfootProducts = await request(app).get('/products').set('Host', 'www.chinabigfoot.com');
  const bigfootSolutions = await request(app).get('/solutions').set('Host', 'www.chinabigfoot.com');
  const bigfootSolutionDetail = await request(app).get('/solutions/smart-water').set('Host', 'www.chinabigfoot.com');
  const bigfootProductDetail = await request(app).get('/products/billing-suite').set('Host', 'www.chinabigfoot.com');
  const bigfootNews = await request(app).get('/news').set('Host', 'www.chinabigfoot.com');
  const bigfootNewsDetail = await request(app).get('/news/contract-water-saving').set('Host', 'www.chinabigfoot.com');
  const bigfootCases = await request(app).get('/cases').set('Host', 'www.chinabigfoot.com');
  const bigfootCaseDetail = await request(app).get('/cases/zhongshan-water').set('Host', 'www.chinabigfoot.com');
  const bigfootContact = await request(app).get('/contact').set('Host', 'www.chinabigfoot.com');
  const adminLogin = await request(app).get('/admin/login');

  assert.equal(dmaHome.status, 200);
  assert.equal(dmaAbout.status, 200);
  assert.equal(dmaProducts.status, 200);
  assert.equal(dmaSolutions.status, 200);
  assert.equal(dmaSolutionDetail.status, 200);
  assert.equal(dmaProductDetail.status, 200);
  assert.equal(dmaNews.status, 200);
  assert.equal(dmaNewsDetail.status, 200);
  assert.equal(dmaCases.status, 200);
  assert.equal(dmaCaseDetail.status, 200);
  assert.equal(dmaContact.status, 200);
  assert.equal(bigfootHome.status, 200);
  assert.equal(bigfootAbout.status, 200);
  assert.equal(bigfootProducts.status, 200);
  assert.equal(bigfootSolutions.status, 200);
  assert.equal(bigfootSolutionDetail.status, 200);
  assert.equal(bigfootProductDetail.status, 200);
  assert.match(bigfootProductDetail.text, /产品画册|下载资料/);
  assert.equal(bigfootNews.status, 200);
  assert.equal(bigfootNewsDetail.status, 200);
  assert.equal(bigfootCases.status, 200);
  assert.equal(bigfootCaseDetail.status, 200);
  assert.equal(bigfootContact.status, 200);
  assert.equal(adminLogin.status, 200);
});
```

- [ ] **Step 2: Run the end-to-end smoke test to verify it fails**

Run: `node --test tests/end-to-end-smoke.test.js`
Expected: FAIL until the final seeded flow, route coverage, and templates are complete.

- [ ] **Step 3: Apply the final visual polish and responsive refinement**

Focus on:

- stronger typography hierarchy
- more polished homepage modules
- consistent button, card, and data-stat styles
- Chinese admin spacing/forms aligned with common mainland SaaS conventions

- [ ] **Step 4: Write the deployment and operating documentation**

Document:

- environment variables
- first-run database seeding
- local dev commands
- upload storage assumptions
- Alibaba Cloud ECS deployment layout
- reverse proxy / process manager expectations

- [ ] **Step 5: Re-run the end-to-end smoke test**

Run: `node --test tests/end-to-end-smoke.test.js`
Expected: PASS

- [ ] **Step 6: Run the full verification suite**

Run:

```bash
npm test -- --test-name-pattern="admin"
npm test
npm start
# separate shell
curl -I http://localhost:3000/health
curl -I http://localhost:3000/admin/login
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/about
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/products
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/solutions
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/solutions/dma-lite-solution
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/products/dma-lite
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/news
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/news/mnf-observation
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/cases
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/cases/qingyuan-water
curl -I -H 'Host: dma.b8water.com' http://localhost:3000/contact
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/about
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/products
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/solutions
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/solutions/smart-water
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/products/billing-suite
curl -H 'Host: www.chinabigfoot.com' http://localhost:3000/products/billing-suite | grep -E '产品画册|下载资料'
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/news
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/news/contract-water-saving
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/cases
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/cases/zhongshan-water
curl -I -H 'Host: www.chinabigfoot.com' http://localhost:3000/contact
```

Expected:

- all automated tests pass
- `tests/admin-crud.test.js` proves CRUD coverage for settings/contact/SEO, homepage sections, navigation, pages, products, solutions, news, cases, and media
- health endpoint returns 200
- admin login page returns 200
- both site homepages return 200
- both sites' about pages return 200
- both sites' products indexes return 200
- both sites' solutions indexes return 200
- both sites' sample solution detail pages return 200
- both sites' sample product detail pages return 200
- migrated brochure/download links render on the relevant public product page
- both sites' news indexes return 200
- both sites' sample news detail pages return 200
- both sites' exposed case pages return 200
- both sites' sample case detail pages return 200
- both sites' contact pages return 200

- [ ] **Step 7: Commit the finished delivery**

```bash
git add README.md docs public src tests .env.example package.json package-lock.json
git commit -m $'feat: complete b8 multisite website platform\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'
```
